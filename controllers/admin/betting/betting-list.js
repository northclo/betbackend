import BettingResultModel from "../../../models/BettingResult.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseSuccess } from "../../../helper/response.js";
import moment from "moment";

const normalizeDate = (value, isEnd = false) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (isEnd) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }
    return date;
};

export const getBettingList = async (req, res) => {
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
    const end = normalizeDate(endDate, true);

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
    const skip = (pageNumber - 1) * limit;

    let filter = {};

    // Date filter
    if (start || end) {
        filter.createdAt = {};
        if (start) filter.createdAt.$gte = start;
        if (end) filter.createdAt.$lte = end;
    }

    // Betting status filter
    if (bettingStatus) {
        filter.betting_status = bettingStatus;
    }

    // Betting type filter
    if (bettingType) {
        filter.betting_type = bettingType;
    }

    // Win filter
    if (win !== undefined && win !== '') {
        filter.win = win === 'true' || win === true;
    }

    // User status filter (will be applied after user lookup)
    let userStatusFilter = userStatus ? { user_status: userStatus } : {};

    // Partner filter
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

    // Search filter
    const searchRegex = search ? new RegExp(search, "i") : null;

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
                preserveNullAndEmptyArrays: false
            }
        }
    ];

    // Apply user status filter
    if (Object.keys(userStatusFilter).length) {
        basePipeline.push({ $match: { "user.user_status": userStatusFilter.user_status } });
    }

    // Apply partner filter
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
        // If partner filter is set but no partners found, return empty result
        basePipeline.push({ $match: { _id: { $exists: false } } });
    }

    // Apply search filter
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
                // Convert search to number for Round ID search
                const numericSearch = Number(search);
                if (Number.isFinite(numericSearch)) {
                    searchMatch[searchField] = numericSearch;
                } else {
                    // If not a valid number, return empty results
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

    // Add partner lookups and game result lookup
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

    // Parse sort
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
                            user_nickname: "$user.user_nickname",
                            user_email: "$user.user_email",
                            user_name: "$user.user_name",
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
};

