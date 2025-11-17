import BettingResultModel from "../../../models/BettingResult.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";
import moment from "moment-timezone";
import { config } from "../../../config/index.js";
import { t } from "../../../helper/translation.js";

const normalizeDate = (value, isEnd = false) => {
    if (!value) return null;
    
    let dateMoment = moment.tz(value, "YYYY-MM-DD", config.TIME_ZONE);
    
    if (!dateMoment.isValid()) {
        dateMoment = moment.tz(value, config.TIME_ZONE);
    }
    
    if (!dateMoment.isValid()) {
        return null;
    }
    
    if (isEnd) {
        dateMoment = dateMoment.endOf('day');
    } else {
        dateMoment = dateMoment.startOf('day');
    }
    
    return dateMoment.toDate();
};

export const getBettingList = async (req, res) => {
    try {
        let {
            startDate,
            endDate,
            userStatus,
            partner,
            includeSub,
            searchField,
            search,
            bettingStatus,
            bettingType,
            win,
            sort = "created_date",
            page = 1,
            pageSize = 10
        } = req.query;

        const start = normalizeDate(startDate);
        if (startDate && start === null) {
            return responseBadRequest(res, t("invalid_start_date_format"));
        }
        
        const end = normalizeDate(endDate, true);
        if (endDate && end === null) {
            return responseBadRequest(res, t("invalid_end_date_format"));
        }

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
        const skip = (pageNumber - 1) * limit;

        let filter = {};

        if (start || end) {
            filter.createdAt = {};
            if (start) filter.createdAt.$gte = start;
            if (end) filter.createdAt.$lte = end;
        }

        if (bettingStatus) {
            filter.betting_status = bettingStatus;
        }

        if (bettingType) {
            filter.betting_type = bettingType;
        }

        if (win !== undefined && win !== '') {
            filter.win = win === 'true' || win === true;
        }

        let userStatusFilter = userStatus ? { user_status: userStatus } : {};

        let partnerIds = [];
        const includeSubPartners = includeSub === "true";
        if (partner) {
            if (includeSubPartners) {
                const rootPartners = await PartnerModel.find({ role: partner }).select("_id").lean();
                if (rootPartners.length) {
                    const roots = rootPartners.map((p) => p._id);
                    const subTree = await PartnerModel.aggregate([
                        { $match: { _id: { $in: roots } } },
                        {
                            $graphLookup: {
                                from: "partners",
                                startWith: "$_id",
                                connectFromField: "_id",
                                connectToField: "parent_partner_id",
                                as: "all_subs"
                            }
                        }
                    ]);

                    partnerIds = [
                        ...roots,
                        ...subTree.flatMap((d) => (d.all_subs || []).map((sp) => sp._id))
                    ];
                }
            } else {
                const directPartners = await PartnerModel.find({ role: partner }).select("_id").lean();
                partnerIds = directPartners.map((p) => p._id);
            }
        }

        let searchRegex = null;
        if (search) {
            try {
                const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                searchRegex = new RegExp(escapedSearch, "i");
            } catch (error) {
                return responseBadRequest(res, t("invalid_search_pattern"));
            }
        }

        const basePipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: {
                    path: "$user",
                    preserveNullAndEmptyArrays: true
                }
            }
        ];

        if (Object.keys(userStatusFilter).length) {
            basePipeline.push({ 
                $match: { 
                    $and: [
                        { "user": { $ne: null } },
                        { "user.user_status": userStatusFilter.user_status }
                    ]
                } 
            });
        }

        if (partnerIds.length) {
            basePipeline.push({
                $match: {
                    $or: [
                        { "user.partner_id": { $in: partnerIds } },
                        { "user.own_partner_id": { $in: partnerIds } }
                    ]
                }
            });
        } else if (partner) {
            basePipeline.push({ $match: { _id: { $exists: false } } });
        }

        if (search && searchField) {
            const searchMatch = {};
            switch (searchField) {
                case "user_id":
                    searchMatch.$or = [
                        { "user.user_email": searchRegex },
                        { "user.user_name": searchRegex },
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $toString: "$user._id" },
                                    regex: searchRegex.source,
                                    options: searchRegex.flags
                                }
                            }
                        }
                    ];
                    break;
                case "user_nickname":
                    searchMatch["user.user_nickname"] = searchRegex;
                    break;
                case "game_id":
                    searchMatch.game_id = searchRegex;
                    break;
                case "betting_type":
                    searchMatch.betting_type = searchRegex;
                    break;
                case "total_no":
                case "today_no":
                    const numericSearch = Number(search);
                    if (Number.isFinite(numericSearch)) {
                        searchMatch[searchField] = numericSearch;
                    } else {
                        searchMatch._id = { $exists: false };
                    }
                    break;
                default:
                    searchMatch.$or = [
                        { "user.user_nickname": searchRegex },
                        { "user.user_email": searchRegex },
                        { "user.user_name": searchRegex },
                        { game_id: searchRegex },
                        { betting_type: searchRegex }
                    ];
            }
            basePipeline.push({ $match: searchMatch });
        }

        basePipeline.push(
            {
                $lookup: {
                    from: "partners",
                    localField: "user.own_partner_id",
                    foreignField: "_id",
                    as: "own_partners"
                }
            },
            {
                $lookup: {
                    from: "partners",
                    localField: "user.partner_id",
                    foreignField: "_id",
                    as: "partners"
                }
            },
            {
                $lookup: {
                    from: "game_results",
                    localField: "game_id",
                    foreignField: "game_id",
                    as: "game_result"
                }
            },
            {
                $addFields: {
                    own_partner: { $arrayElemAt: ["$own_partners", 0] },
                    partner: { $arrayElemAt: ["$partners", 0] },
                    game: { $arrayElemAt: ["$game_result", 0] },
                    user_id_text: { $toString: "$user._id" }
                }
            }
        );

        const parseSort = (value) => {
            if (!value) return ["created_date", -1];
            const [field, direction = "desc"] = value.split(":");
            return [field, direction.toLowerCase() === "asc" ? 1 : -1];
        };

        const [sortField, sortDirection] = parseSort(sort);
        let sortStage;
        switch (sortField) {
            case "created_date":
                sortStage = { createdAt: sortDirection };
                break;
            case "bet_amount":
                sortStage = { bet_amount: sortDirection };
                break;
            case "earning_amount":
                sortStage = { earning_amount: sortDirection };
                break;
            case "game_id":
                sortStage = { game_id: sortDirection };
                break;
            case "total_no":
                sortStage = { total_no: sortDirection };
                break;
            default:
                sortStage = { createdAt: -1 };
        }

        const aggregation = await BettingResultModel.aggregate([
            {
                $facet: {
                    data: [
                        ...basePipeline,
                        { $sort: sortStage },
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                _id: 1,
                                betting_id: { $toString: "$_id" },
                                user_id: "$user_id_text",
                                user_nickname: { $ifNull: ["$user.user_nickname", ""] },
                                user_email: { $ifNull: ["$user.user_email", ""] },
                                user_name: { $ifNull: ["$user.user_name", ""] },
                                game_id: 1,
                                total_no: 1,
                                today_no: 1,
                                betting_type: 1,
                                betting_rate: 1,
                                win: 1,
                                number_sort: 1,
                                bet_amount: 1,
                                earning_amount: 1,
                                betting_status: 1,
                                history_view: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                own_partner_id: { $ifNull: [{ $toString: "$own_partner._id" }, ""] },
                                own_partner_nickname: { $ifNull: ["$own_partner.nickname", ""] },
                                own_partner_role: { $ifNull: ["$own_partner.role", ""] },
                                partner_id: { $ifNull: [{ $toString: "$partner._id" }, ""] },
                                partner_nickname: { $ifNull: ["$partner.nickname", ""] },
                                partner_role: { $ifNull: ["$partner.role", ""] },
                                game_list: { $ifNull: ["$game.list", []] },
                                game_odd: { $ifNull: ["$game.odd", null] },
                                game_under: { $ifNull: ["$game.under", null] },
                                game_start_time: { $ifNull: ["$game.start_time_stamp", null] }
                            }
                        }
                    ],
                    total: [
                        ...basePipeline,
                        { $count: "count" }
                    ]
                }
            }
        ]);

        const list = aggregation[0]?.data || [];
        const total =
            aggregation[0]?.total && aggregation[0].total.length
                ? aggregation[0].total[0].count
                : 0;

        responseSuccess(res, {
            list,
            total,
            page: pageNumber,
            pageSize: limit
        });
    } catch (error) {
        console.error("Error in getBettingList:", error);
        return responseBadRequest(res, t("error_fetching_betting_list"));
    }
};

