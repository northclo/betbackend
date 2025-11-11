import bcrypt from 'bcrypt';

import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseSuccess } from "../../../helper/response.js";

export const getMemberList = async (req, res) => {
    let {
        duration,
        startDate,
        endDate,
        userStatus,
        partner,
        includeSub,
        searchField,
        search,
        currentLoggedinUser,
        considerUser,
        sort
    } = req.query;

    // normalize dates
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : null;

    let filter = {};

    // user_status filter
    if (userStatus) {
        filter.user_status = userStatus;
    }

    // current logged-in users filter
    if (currentLoggedinUser === "true") {
        filter.login_status = true;
    }

    // consider_user filter
    if (considerUser === "true") {
        filter.consider_user = true;
    }

    // handle partner filter (with includeSub)
    let partnerIds = [];
    if (partner) {
        if (includeSub === "true") {
            const rootPartners = await PartnerModel.find({ role: partner }).select("_id").lean();
            if (rootPartners.length) {
                const roots = rootPartners.map(p => p._id);
                const subTree = await PartnerModel.aggregate([
                    {
                        $match: { _id: { $in: roots } }
                    },
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
                    ...subTree.flatMap(d => (d.all_subs || []).map(sp => sp._id))
                ];
            }
        } else {
            const directPartners = await PartnerModel.find({ role: partner }).select("_id").lean();
            partnerIds = directPartners.map(p => p._id);
        }

        if (partnerIds.length) {
            filter.$or = [
                { partner_id: { $in: partnerIds } },
                { own_partner_id: { $in: partnerIds } }
            ];
        } else {
            // no partners found -> return empty result
            filter.$and = filter.$and || [];
            filter.$and.push({ _id: { $exists: false } });
        }
    }

    const isCreatedDate = duration === "created_date" && (start || end);
    const isPasswordChangedDate = duration === "password_changed_date" && (start || end);
    const isConnectedDate = duration === "connected_date" && (start || end);

    // apply user-level date filters
    if (isCreatedDate) {
        if (start) filter.createdAt = { ...(filter.createdAt || {}), $gte: start };
        if (end) filter.createdAt = { ...(filter.createdAt || {}), $lte: end };
    }

    if (isPasswordChangedDate) {
        if (start) filter.password_change_time = { ...(filter.password_change_time || {}), $gte: start.getTime() };
        if (end) filter.password_change_time = { ...(filter.password_change_time || {}), $lte: end.getTime() };
    }

    // build aggregate pipeline
    const pipeline = [
        { $match: filter },
        {
            $addFields: {
                current_balance: { $ifNull: ["$current_balance", 0] },
                pending_addfund_balance: { $ifNull: ["$pending_addfund_balance", 0] },
                pending_refund_balance: { $ifNull: ["$pending_refund_balance", 0] },
            }
        },

        // join partner references
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

        // lookup last login (array) — we'll extract scalar last_login_time next
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

        // make scalar last_login_time for reliable filtering & sorting
        {
            $addFields: {
                last_login_time: { $arrayElemAt: ["$login_history.createdAt", 0] }
            }
        },

        // unwind login_history for cases where we need to preserve/exclude docs by connected_date
        {
            $unwind: {
                path: "$login_history",
                preserveNullAndEmptyArrays: !isConnectedDate
            }
        },

        // betting stats (earning, wins, betting amount)
        {
            $lookup: {
                from: "betting_results",
                let: { userId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$user_id", "$$userId"] } } },
                    {
                        $group: {
                            _id: null,
                            totalEarningAmount: { $sum: "$earning_amount" },
                            totalWinCount: { $sum: { $cond: [{ $eq: ["$win", true] }, 1, 0] } },
                            totalBettingAmount: { $sum: "$bet_amount" }
                        }
                    }
                ],
                as: "betting_stats"
            }
        },
        {
            $addFields: {
                totalEarningAmount: { $ifNull: [{ $arrayElemAt: ["$betting_stats.totalEarningAmount", 0] }, 0] },
                totalWinCount: { $ifNull: [{ $arrayElemAt: ["$betting_stats.totalWinCount", 0] }, 0] },
                totalBettingAmount: { $ifNull: [{ $arrayElemAt: ["$betting_stats.totalBettingAmount", 0] }, 0] }
            }
        },


        // compute total partner earning: sum earnings of members whose partner_id === this user's own_partner_id
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
                                { $match: { $expr: { $eq: ["$user_id", "$$memberId"] } } },
                                { $group: { _id: null, memberEarning: { $sum: "$earning_amount" } } }
                            ],
                            as: "member_earnings"
                        }
                    },
                    {
                        $addFields: {
                            memberEarning: { $ifNull: [{ $arrayElemAt: ["$member_earnings.memberEarning", 0] }, 0] }
                        }
                    },
                    { $group: { _id: null, partnerTotalEarning: { $sum: "$memberEarning" } } }
                ],
                as: "partner_earnings"
            }
        },
        {
            $addFields: {
                totalPartnerEarning: { $ifNull: [{ $arrayElemAt: ["$partner_earnings.partnerTotalEarning", 0] }, 0] }
            }
        }
    ];

    // connected_date filter (use scalar last_login_time)
    if (isConnectedDate) {
        const loginMatch = {};
        if (start) loginMatch["last_login_time"] = { ...(loginMatch["last_login_time"] || {}), $gte: start };
        if (end) loginMatch["last_login_time"] = { ...(loginMatch["last_login_time"] || {}), $lte: end };
        if (Object.keys(loginMatch).length) pipeline.push({ $match: loginMatch });
    }


    // sorting logic (supports optional direction after colon, e.g. sort=created_date:asc)
    if (sort) {
        let sortStage = {};
        switch (sort) {
            case "created_date":
                sortStage = { createdAt: -1 };
                break;
            case "owned_money":
                sortStage = { current_balance: -1 };
                break;
            case "owned_point":
                sortStage = { point: -1 };
                break;
            case "connect_date":
                sortStage = { last_login_time: -1 }; // use scalar field
                break;
            case "import_money":
            case "exchange_money":
                break;
            default:
                sortStage = {};
        }

        if (Object.keys(sortStage).length) {
            pipeline.push({ $sort: sortStage });
        }
    }

    const users = await UserModel.aggregate(pipeline);

    responseSuccess(res, users);
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