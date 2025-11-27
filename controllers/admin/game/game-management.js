import moment from "moment";
import GameResultModel from "../../../models/GameResult.js";
import BettingResultModel from "../../../models/BettingResult.js";
import { responseBadRequest, responseSuccess, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

const ALLOWED_STATUS = ["", "register", "under", "end", "finish", "cancel"];
const ALLOWED_SEARCH_FIELDS = ["total_no", "today_no"];

const buildStatusFilter = (status, now) => {
    const notCancelled = {
        $or: [
            { cancel_time_stamp: { $exists: false } },
            { cancel_time_stamp: null },
            { cancel_time_stamp: { $lte: 0 } },
            { cancel_time_stamp: { $gt: now } }
        ]
    };

    switch (status) {
        case "register":
            return {
                $and: [
                    { start_time_stamp: { $exists: true, $gt: now } },
                    notCancelled
                ]
            };
        case "under":
            return {
                $and: [
                    { start_time_stamp: { $exists: true, $lte: now } },
                    { end_time_stamp: { $exists: true, $gt: now } },
                    notCancelled
                ]
            };
        case "end":
            return {
                $and: [
                    {
                        $or: [
                            { end_time_stamp: { $exists: true, $lte: now } },
                            { end_time_stamp: { $exists: false } },
                            { end_time_stamp: null },
                            { end_time_stamp: { $lte: 0 } }
                        ]
                    },
                    notCancelled,
                    {
                        $or: [
                            { list: { $exists: false } },
                            { list: null },
                            { list: [] },
                            { $expr: { $eq: [{ $size: { $ifNull: ["$list", []] } }, 0] } }
                        ]
                    }
                ]
            };
        case "finish":
            return {
                $and: [
                    {
                        $or: [
                            { end_time_stamp: { $exists: true, $lte: now } },
                            { end_time_stamp: { $exists: false } },
                            { end_time_stamp: null },
                            { end_time_stamp: { $lte: 0 } }
                        ]
                    },
                    notCancelled,
                    {
                        list: { $exists: true, $ne: null, $type: "array" },
                        $expr: { $gt: [{ $size: "$list" }, 0] }
                    }
                ]
            };
        case "cancel":
            return {
                $and: [
                    { cancel_time_stamp: { $exists: true } },
                    { cancel_time_stamp: { $gt: 0 } },
                    { cancel_time_stamp: { $lte: now } }
                ]
            };
        default:
            return {};
    }
};

export const getGameManagement = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        const { status = "", searchField, search, page = 1, pageSize = 10 } = req.query;
        const normalizedStatus = (status || "").toString().trim().toLowerCase();
        const now = Date.now();

        if (!ALLOWED_STATUS.includes(normalizedStatus)) {
            return responseBadRequest(res, t("invalid_status_filter"));
        }

        let filter = buildStatusFilter(normalizedStatus, now);

        if (normalizedStatus !== "register") {
            const roundNumberFilter = {
                $and: [
                    { total_no: { $exists: true, $ne: null } },
                    { today_no: { $exists: true, $ne: null } }
                ]
            };
            
            if (filter.$and) {
                filter.$and.push(roundNumberFilter);
            } else if (Object.keys(filter).length > 0) {
                filter = { $and: [filter, roundNumberFilter] };
            } else {
                filter = roundNumberFilter;
            }
        }

        if (searchField || search) {
            if (!searchField || !search) {
                return responseBadRequest(res, t("both_searchfield_search_required"));
            }
            if (!ALLOWED_SEARCH_FIELDS.includes(searchField)) {
                return responseBadRequest(res, t("invalid_search_field"));
            }

            const numericSearch = Number(search);
            if (!Number.isFinite(numericSearch)) {
                return responseBadRequest(res, t("search_value_must_number"));
            }
            
            const searchFilter = { [searchField]: numericSearch };
            if (filter.$and) {
                filter.$and.push(searchFilter);
            } else if (Object.keys(filter).length > 0) {
                filter = { $and: [filter, searchFilter] };
            } else {
                filter = searchFilter;
            }
        }

        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const pageSizeNumber = Math.min(Math.max(1, parseInt(pageSize, 10) || 10), 100);
        const skip = (pageNumber - 1) * pageSizeNumber;

        const aggregationPipeline = [
            { $match: filter },
            {
                $addFields: {
                    hasRoundNumbers: {
                        $and: [
                            { $ne: ["$total_no", null] },
                            { $ne: ["$today_no", null] }
                        ]
                    },
                    hasResults: {
                        $and: [
                            { $ne: ["$list", null] },
                            { $gt: [{ $size: { $ifNull: ["$list", []] } }, 0] }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    priority: {
                        $add: [
                            { $cond: ["$hasRoundNumbers", 2, 0] },
                            { $cond: ["$hasResults", 1, 0] }
                        ]
                    }
                }
            },
            {
                $sort: {
                    start_time_stamp: -1,
                    priority: -1
                }
            },
            {
                $group: {
                    _id: "$start_time_stamp",
                    doc: { $first: "$$ROOT" }
                }
            },
            {
                $replaceRoot: { newRoot: "$doc" }
            },
            {
                $sort: { start_time_stamp: -1 }
            },
            {
                $facet: {
                    paginatedResults: [
                        { $skip: skip },
                        { $limit: pageSizeNumber }
                    ],
                    totalCount: [
                        { $count: "count" }
                    ]
                }
            }
        ];

        const aggregationResult = await GameResultModel.aggregate(aggregationPipeline, { maxTimeMS: 30000 });
        
        if (!aggregationResult || aggregationResult.length === 0) {
            return responseSuccess(res, {
                items: [],
                pagination: {
                    total: 0,
                    page: pageNumber,
                    pageSize: pageSizeNumber
                }
            });
        }

        const resultData = aggregationResult[0];
        const gameResult = resultData.paginatedResults || [];
        const total = resultData.totalCount && resultData.totalCount.length > 0 
            ? resultData.totalCount[0].count 
            : 0;

        const gameIds = gameResult.map(g => g.game_id).filter(Boolean);

        const bettingMatchFilter = {
            game_id: { $in: gameIds },
            betting_status: { $ne: "CANCEL" }
        };

        if (accessibleUserIds.length > 0) {
            bettingMatchFilter.user_id = { $in: accessibleUserIds };
        } else {
            bettingMatchFilter.user_id = { $in: [] };
        }

        const bettingCounts = gameIds.length > 0 ? await BettingResultModel.aggregate([
            {
                $match: bettingMatchFilter
            },
            {
                $group: {
                    _id: {
                        game_id: "$game_id",
                        betting_type: "$betting_type"
                    },
                    count: { $sum: 1 }
                }
            }
        ], { maxTimeMS: 30000 }) : [];

        const bettingCountMap = {};
        bettingCounts.forEach(item => {
            const gameId = item._id.game_id;
            const bettingType = item._id.betting_type;
            if (!bettingCountMap[gameId]) {
                bettingCountMap[gameId] = {};
            }
            bettingCountMap[gameId][bettingType] = item.count;
        });

        const getBettingCount = (gameId, bettingType) => {
            return bettingCountMap[gameId]?.[bettingType] || 0;
        };

        const getBettingCounts = (gameId) => {
            return {
                odd: getBettingCount(gameId, "odd"),
                even: getBettingCount(gameId, "even"),
                under: getBettingCount(gameId, "under"),
                over: getBettingCount(gameId, "over"),
                odd_under: getBettingCount(gameId, "odd_under"),
                odd_over: getBettingCount(gameId, "odd_over"),
                even_under: getBettingCount(gameId, "even_under"),
                even_over: getBettingCount(gameId, "even_over")
            };
        };

        const result = gameResult.map((element) => {
            const startStamp = element.start_time_stamp ?? 0;
            const endStamp = element.end_time_stamp ?? 0;
            const cancelStamp = element.cancel_time_stamp ?? null;

            let gameStatus = "f";
            if (startStamp > now) {
                gameStatus = "r";
            } else if (startStamp <= now && endStamp > now) {
                gameStatus = "s";
            } else if (cancelStamp && cancelStamp > 0 && cancelStamp <= now) {
                gameStatus = "c";
            } else if (endStamp <= now) {
                if (!element.list || element.list.length === 0) {
                    gameStatus = "e";
                } else {
                    gameStatus = "f";
                }
            }

            let remainedTime = 0;
            if (gameStatus === "r") {
                remainedTime = Math.max(0, startStamp - now);
            } else if (gameStatus === "s") {
                remainedTime = Math.max(0, endStamp - now);
            } else {
                remainedTime = 0;
            }

            const bettingCounts = getBettingCounts(element.game_id);

            return {
                key: element._id.toString(),
                total_no: element.total_no,
                today_no: element.today_no,
                startTime: startStamp ? moment(startStamp).format("YYYY-MM-DD HH:mm") : "",
                remainedTime: remainedTime,
                odd: element.odd,
                under: element.under,
                status: gameStatus,
                bettingCounts: bettingCounts
            };
        });

        responseSuccess(res, {
            items: result,
            pagination: {
                total,
                page: pageNumber,
                pageSize: pageSizeNumber
            }
        });
    } catch (error) {
        console.error("Error Get Game Management Data:", error);
        return responseServerError(res);
    }
};