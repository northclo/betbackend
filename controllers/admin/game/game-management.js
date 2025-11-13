import moment from "moment";
import GameResultModel from "../../../models/GameResult.js";
import BettingResultModel from "../../../models/BettingResult.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";

const ALLOWED_STATUS = ["", "register", "under", "end", "finish", "cancel"];
const ALLOWED_SEARCH_FIELDS = ["total_no", "today_no"];

const buildStatusFilter = (status, now) => {
    switch (status) {
        case "register":
            return { start_time_stamp: { $gt: now } };
        case "under":
            return {
                start_time_stamp: { $lte: now },
                end_time_stamp: { $gt: now }
            };
        case "end":
            return {
                end_time_stamp: { $lte: now },
                cancel_time_stamp: { $exists: true, $gt: 0, $gt: now }
            };
        case "finish":
            return {
                end_time_stamp: { $lte: now },
                $or: [
                    { cancel_time_stamp: { $exists: false } },
                    { cancel_time_stamp: null },
                    { cancel_time_stamp: { $lte: 0 } }
                ]
            };
        case "cancel":
            return {
                cancel_time_stamp: { $exists: true, $gt: 0, $lte: now }
            };
        default:
            return {};
    }
};

export const getGameManagement = async (req, res) => {
    const { status = "", searchField, search, page = 1, pageSize = 10 } = req.query;
    const normalizedStatus = status.trim().toLowerCase();
    const now = Date.now();

    if (!ALLOWED_STATUS.includes(normalizedStatus)) {
        return responseBadRequest(res, "Invalid status filter.");
    }

    const filter = buildStatusFilter(normalizedStatus, now);

    if (searchField || search) {
        if (!searchField || !search) {
            return responseBadRequest(res, "Both searchField and search must be provided.");
        }
        if (!ALLOWED_SEARCH_FIELDS.includes(searchField)) {
            return responseBadRequest(res, "Invalid search field.");
        }

        const numericSearch = Number(search);
        if (!Number.isFinite(numericSearch)) {
            return responseBadRequest(res, "Search value must be a valid number.");
        }
        filter[searchField] = numericSearch;
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNumber = Math.min(Math.max(1, parseInt(pageSize, 10) || 10), 100);
    const skip = (pageNumber - 1) * pageSizeNumber;

    const [total, gameResult] = await Promise.all([
        GameResultModel.countDocuments(filter),
        GameResultModel.find(filter)
            .sort({ start_time_stamp: -1 })
            .skip(skip)
            .limit(pageSizeNumber)
    ]);

    const gameIds = gameResult.map(g => g.game_id).filter(Boolean);

    const bettingCounts = gameIds.length > 0 ? await BettingResultModel.aggregate([
        {
            $match: {
                game_id: { $in: gameIds },
                betting_status: { $ne: "cancel" }
            }
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
    ]) : [];

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
        } else if (endStamp <= now && cancelStamp && cancelStamp > 0 && now < cancelStamp) {
            gameStatus = "e";
        } else if (cancelStamp && cancelStamp > 0 && cancelStamp <= now) {
            gameStatus = "c";
        } else if (endStamp <= now) {
            gameStatus = "f";
        } else {
            gameStatus = "f";
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
            list: element.list,
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
};