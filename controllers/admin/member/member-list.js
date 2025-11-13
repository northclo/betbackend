import bcrypt from 'bcrypt';

import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseSuccess } from "../../../helper/response.js";

export const getMemberList = async (req, res) => {
    let {
        duration = "import_exchange_betting",
        startDate,
        endDate,
        userStatus,
        partner,
        includeSub,
        searchField,
        search,
        currentLoggedinUser,
        considerUser,
        sort = "created_date",
        page = 1,
        pageSize = 10
    } = req.query;

    const normalizeDate = (value, isEnd = false) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        if (isEnd) {
            date.setHours(23, 59, 59, 999);
        }
        return date;
    };

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate, true);

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
    const skip = (pageNumber - 1) * limit;

    let filter = {};

    if (userStatus) {
        filter.user_status = userStatus;
    }

    if (currentLoggedinUser === "true") {
        filter.login_status = true;
    }

    if (considerUser === "true") {
        filter.consider_user = true;
    }

    const searchRegex = search ? new RegExp(search, "i") : null;
    if (search && searchField) {
        const textFieldMap = {
            user_nickname: "user_nickname",
            memo: "memo_note",
            bank_owner: "bank_owner_name",
            phone_number: "phone_number",
            bank_account: "bank_number",
            recommended_user: "recommend_id"
        };

        switch (searchField) {
            case "cash_remained_over":
            case "cash_remained_under": {
                const amount = Number(search);
                if (!Number.isNaN(amount)) {
                    const operator = searchField === "cash_remained_over" ? "$gte" : "$lte";
                    filter.own_money = {
                        ...(filter.own_money || {}),
                        [operator]: amount
                    };
                }
                break;
            }
            case "user_id": {
                filter.$and = filter.$and || [];
                const idConditions = [
                    { user_email: searchRegex },
                    { user_name: searchRegex }
                ];
                filter.$and.push({
                    $or: [
                        ...idConditions,
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $toString: "$_id" },
                                    regex: searchRegex.source,
                                    options: searchRegex.flags
                                }
                            }
                        }
                    ]
                });
                break;
            }
            default: {
                const fieldName = textFieldMap[searchField];
                if (fieldName) {
                    filter[fieldName] = searchRegex;
                }
                break;
            }
        }
    }

    // partner filter
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

        if (partnerIds.length) {
            filter.$or = [
                { partner_id: { $in: partnerIds } },
                { own_partner_id: { $in: partnerIds } }
            ];
        } else {
            filter.$and = filter.$and || [];
            filter.$and.push({ _id: { $exists: false } });
        }
    }

    const isCreatedDate = duration === "created_date" && (start || end);
    const isPasswordChangedDate = duration === "password_changed_date" && (start || end);
    const isConnectedDate = duration === "connected_date" && (start || end);
    const isLastImportDate = duration === "last_import_date" && (start || end);
    const applyFundDateFilter = (duration === "import_exchange_betting" || duration === "last_import_date") && (start || end);
    const applyBettingDateFilter = duration === "import_exchange_betting" && (start || end);

    if (isCreatedDate) {
        if (start) filter.createdAt = { ...(filter.createdAt || {}), $gte: start };
        if (end) filter.createdAt = { ...(filter.createdAt || {}), $lte: end };
    }

    if (isPasswordChangedDate) {
        if (start) filter.password_change_time = { ...(filter.password_change_time || {}), $gte: start.getTime() };
        if (end) filter.password_change_time = { ...(filter.password_change_time || {}), $lte: end.getTime() };
    }

    const buildRangeQuery = () => {
        const range = {};
        if (start) range.$gte = start;
        if (end) range.$lte = end;
        return Object.keys(range).length ? range : null;
    };

    const bettingDateRange = applyBettingDateFilter ? buildRangeQuery() : null;
    const fundDateRange = applyFundDateFilter ? buildRangeQuery() : null;

    const basePipeline = [
        { $match: filter },
        {
            $addFields: {
                own_money: { $ifNull: ["$own_money", 0] },
                pending_addfund_balance: { $ifNull: ["$pending_addfund_balance", 0] },
                pending_refund_balance: { $ifNull: ["$pending_refund_balance", 0] }
            }
        },
        {
            $lookup: {
                from: "partners",
                localField: "own_partner_id",
                foreignField: "_id",
                as: "own_partners"
            }
        },
        {
            $lookup: {
                from: "partners",
                localField: "partner_id",
                foreignField: "_id",
                as: "partners"
            }
        },
        {
            $lookup: {
                from: "user_login_histories",
                let: { userId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$user_id", "$$userId"] } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 1 },
                    { $project: { createdAt: 1 } }
                ],
                as: "login_history"
            }
        },
        {
            $addFields: {
                last_login_time: { $arrayElemAt: ["$login_history.createdAt", 0] }
            }
        },
        {
            $unwind: {
                path: "$login_history",
                preserveNullAndEmptyArrays: !isConnectedDate
            }
        },
        {
            $lookup: {
                from: "betting_results",
                let: { userId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$user_id", "$$userId"] },
                            ...(bettingDateRange ? { createdAt: bettingDateRange } : {})
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalEarningAmount: { $sum: "$earning_amount" },
                            totalWinCount: {
                                $sum: {
                                    $cond: [{ $eq: ["$win", true] }, 1, 0]
                                }
                            },
                            totalBettingAmount: { $sum: "$bet_amount" }
                        }
                    }
                ],
                as: "betting_stats"
            }
        },
        {
            $lookup: {
                from: "transaction_histories",
                let: { userId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$user_id", "$$userId"] },
                            ...(fundDateRange ? { createdAt: fundDateRange } : {})
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalImportAmount: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$fund_type", "IMPORT"] },
                                        "$fund_amount",
                                        0
                                    ]
                                }
                            },
                            totalExchangeAmount: {
                                $sum: {
                                    $cond: [
                                        { $in: ["$fund_type", ["OUTGOING", "EXCHANGE"]] },
                                        "$fund_amount",
                                        0
                                    ]
                                }
                            },
                            lastImportTime: {
                                $max: {
                                    $cond: [
                                        { $eq: ["$fund_type", "IMPORT"] },
                                        "$createdAt",
                                        null
                                    ]
                                }
                            }
                        }
                    }
                ],
                as: "fund_stats"
            }
        },
        {
            $lookup: {
                from: "users",
                let: { partnerId: "$own_partner_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$partner_id", "$$partnerId"] } } },
                    {
                        $lookup: {
                            from: "betting_results",
                            let: { memberId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                            $expr: { $eq: ["$user_id", "$$memberId"] },
                                            ...(bettingDateRange ? { createdAt: bettingDateRange } : {})
                                    }
                                },
                                {
                                    $group: {
                                        _id: null,
                                        memberEarning: { $sum: "$earning_amount" }
                                    }
                                }
                            ],
                            as: "member_earnings"
                        }
                    },
                    {
                        $addFields: {
                            memberEarning: {
                                $ifNull: [{ $arrayElemAt: ["$member_earnings.memberEarning", 0] }, 0]
                            }
                        }
                    },
                    { $group: { _id: null, partnerTotalEarning: { $sum: "$memberEarning" } } }
                ],
                as: "partner_earnings"
            }
        },
        {
            $addFields: {
                totalEarningAmount: {
                    $ifNull: [{ $arrayElemAt: ["$betting_stats.totalEarningAmount", 0] }, 0]
                },
                totalWinCount: {
                    $ifNull: [{ $arrayElemAt: ["$betting_stats.totalWinCount", 0] }, 0]
                },
                totalBettingAmount: {
                    $ifNull: [{ $arrayElemAt: ["$betting_stats.totalBettingAmount", 0] }, 0]
                },
                totalImportAmount: {
                    $ifNull: [{ $arrayElemAt: ["$fund_stats.totalImportAmount", 0] }, 0]
                },
                totalExchangeAmount: {
                    $ifNull: [{ $arrayElemAt: ["$fund_stats.totalExchangeAmount", 0] }, 0]
                },
                last_import_time: {
                    $arrayElemAt: ["$fund_stats.lastImportTime", 0]
                },
                totalPartnerEarning: {
                    $ifNull: [{ $arrayElemAt: ["$partner_earnings.partnerTotalEarning", 0] }, 0]
                }
            }
        }
    ];

    if (isConnectedDate) {
        const loginMatch = {};
        if (start) {
            loginMatch.last_login_time = { ...(loginMatch.last_login_time || {}), $gte: start };
        }
        if (end) {
            loginMatch.last_login_time = { ...(loginMatch.last_login_time || {}), $lte: end };
        }
        if (Object.keys(loginMatch).length) {
            basePipeline.push({ $match: loginMatch });
        }
    }

    if (isLastImportDate) {
        const importMatch = {};
        if (start) {
            importMatch.last_import_time = { ...(importMatch.last_import_time || {}), $gte: start };
        }
        if (end) {
            importMatch.last_import_time = { ...(importMatch.last_import_time || {}), $lte: end };
        }
        if (Object.keys(importMatch).length) {
            basePipeline.push({ $match: importMatch });
        }
    }

    basePipeline.push(
        {
            $project: {
                betting_stats: 0,
                partner_earnings: 0,
                fund_stats: 0
            }
        },
        {
            $addFields: {
                user_id: { $toString: "$_id" }
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
        case "owned_money":
            sortStage = { own_money: sortDirection };
            break;
        case "owned_point":
            sortStage = { point: sortDirection };
            break;
        case "connect_date":
            sortStage = { last_login_time: sortDirection };
            break;
        case "import_money":
            sortStage = { totalImportAmount: sortDirection };
            break;
        case "exchange_money":
            sortStage = { totalExchangeAmount: sortDirection };
            break;
        default:
            sortStage = { createdAt: -1 };
    }

    const aggregation = await UserModel.aggregate([
        {
            $facet: {
                data: [
                    ...basePipeline,
                    { $sort: sortStage },
                    { $skip: skip },
                    { $limit: limit }
                ],
                total: [
                    ...basePipeline,
                    { $count: "count" }
                ]
            }
        }
    ]);

    const users = aggregation[0]?.data || [];
    const total =
        aggregation[0]?.total && aggregation[0].total.length
            ? aggregation[0].total[0].count
            : 0;

    responseSuccess(res, {
        list: users,
        total,
        page: pageNumber,
        pageSize: limit
    });
};


export const updateMemberList = async (req, res) => {
    if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(req.body.password, salt);
    }

    await UserModel.updateOne({ _id: req.body._id }, req.body);
    return responseSuccess(res);
}

export const createMemberList = async (req, res) => {
    let { password } = req.body;

    // change password with hashed password
    const salt = await bcrypt.genSalt(10)
    req.body.password = await bcrypt.hash(password, salt)

    await UserModel.create(req.body);

    return responseSuccess(res)
}

export const deleteMemberList = async (req, res) => {
    let { id } = req.params;

    let deleteFilter = []
    id.split(',').forEach(element => {
        deleteFilter.push({
            _id: element
        })
    });

    await UserModel.deleteMany({
        $or: deleteFilter
    })
    return responseSuccess(res)
}