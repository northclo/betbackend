import BlockIpModel from "../../../models/BlockIp.js";
import UserModel from "../../../models/User.js";
import { responseSuccess } from "../../../helper/response.js";

export const getCurrentLoginUser = async (req, res) => {
    const { start_date, end_date, search_field, search, user_status } = req.query;

    // USER filter
    let filter = { login_status: true };
    if ((search_field === "user_id" || search_field === "user_nickname") && search) {
        filter["user_nickname"] = { $regex: search, $options: "i" };
    }

    if (user_status) {
        filter["user_status"] = user_status;
    }

    // LOGIN HISTORY filter
    let loginHistoryFilter = {};
    if ((search_field === "ip_address" || search_field === "location") && search) {
        loginHistoryFilter[search_field] = { $regex: search };
    }

    if (start_date) {
        loginHistoryFilter["createdAt"] = loginHistoryFilter["createdAt"] || {};
        loginHistoryFilter["createdAt"].$gte = new Date(start_date + "T00:00:00.000Z");
    }

    if (end_date) {
        const end = new Date(end_date + "T23:59:59.999Z");
        loginHistoryFilter["createdAt"] = loginHistoryFilter["createdAt"] || {};
        loginHistoryFilter["createdAt"].$lte = end;
    }

    // PARTNER filter
    let partnerFilter = {};
    if (search_field === "partner" && search) {
        partnerFilter["nickname"] = { $regex: search, $options: "i" };
    }

    // Pipelines
    const ownPartnersPipeline = [
        { $match: { $expr: { $eq: ["$_id", "$$opid"] } } },
        ...(Object.keys(partnerFilter).length ? [{ $match: partnerFilter }] : []),
    ];

    const partnersPipeline = [
        { $match: { $expr: { $eq: ["$_id", "$$pid"] } } },
        ...(Object.keys(partnerFilter).length ? [{ $match: partnerFilter }] : []),
    ];

    const loginHistoryPipeline = [
        { $match: { $expr: { $eq: ["$user_id", "$$uid"] } } },
        ...(Object.keys(loginHistoryFilter).length ? [{ $match: loginHistoryFilter }] : []),
        { $sort: { createdAt: 1 } },
    ];

    // Transactions pipelines
    const totalTransactionsPipeline = [
        { $match: { $expr: { $eq: ["$user_id", "$$uid"] }, fund_status: "COMPLETE" } },
        {
            $group: {
                _id: "$fund_type",
                totalAmount: { $sum: "$fund_amount" },
            },
        },
    ];

    const userImportPipeline = [
        { $match: { $expr: { $eq: ["$action_user", "$$uid"] }, fund_type: "IMPORT", fund_status: "COMPLETE" } },
        {
            $group: {
                _id: null,
                userImportAmount: { $sum: "$fund_amount" },
            },
        },
    ];

    const lastImportPipeline = [
        {
            $match: {
                $expr: { $eq: ["$user_id", "$$uid"] },
                fund_type: "IMPORT",
                fund_status: "COMPLETE",
            },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 1 },
        {
            $project: {
                _id: 0,
                lastImportDate: "$createdAt",
            },
        },
    ];

    // Aggregation
    const aggregation = [
        { $match: filter },

        {
            $lookup: {
                from: "partners",
                let: { opid: "$own_partner_id" },
                pipeline: ownPartnersPipeline,
                as: "own_partners",
            },
        },
        {
            $lookup: {
                from: "partners",
                let: { pid: "$partner_id" },
                pipeline: partnersPipeline,
                as: "partners",
            },
        },
        {
            $lookup: {
                from: "user_login_histories",
                let: { uid: "$_id" },
                pipeline: loginHistoryPipeline,
                as: "login_history",
            },
        },

        // Lookup transactions for totals
        {
            $lookup: {
                from: "transaction_histories",
                let: { uid: "$_id" },
                pipeline: totalTransactionsPipeline,
                as: "transaction_totals",
            },
        },

        // Lookup user’s own import amount
        {
            $lookup: {
                from: "transaction_histories",
                let: { uid: "$_id" },
                pipeline: userImportPipeline,
                as: "user_import",
            },
        },

        // Lookup last import date
        {
            $lookup: {
                from: "transaction_histories",
                let: { uid: "$_id" },
                pipeline: lastImportPipeline,
                as: "last_import",
            },
        },
    ];

    if (search_field === "partner" && search) {
        aggregation.push({
            $match: {
                $or: [{ "own_partners.0": { $exists: true } }, { "partners.0": { $exists: true } }],
            },
        });
    }

    if (Object.keys(loginHistoryFilter).length) {
        aggregation.push({
            $match: { "login_history.0": { $exists: true } },
        });
    }

    aggregation.push({
        $project: {
            _id: 0,
            user_nickname: 1,
            own_money: 1,
            point: 1,
            ip: 1,
            createdAt: 1,
            own_partner: { $arrayElemAt: ["$own_partners", -1] },
            partner: { $arrayElemAt: ["$partners", -1] },
            last_login_history: { $arrayElemAt: ["$login_history", -1] },

            // Compute totals
            total_import_amount: {
                $ifNull: [
                    {
                        $let: {
                            vars: {
                                import: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: "$transaction_totals",
                                                cond: { $eq: ["$$this._id", "IMPORT"] },
                                            },
                                        },
                                        0,
                                    ],
                                },
                            },
                            in: "$$import.totalAmount",
                        },
                    },
                    0,
                ],
            },
            total_exchange_amount: {
                $ifNull: [
                    {
                        $let: {
                            vars: {
                                exchange: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: "$transaction_totals",
                                                cond: { $eq: ["$$this._id", "EXCHANGE"] },
                                            },
                                        },
                                        0,
                                    ],
                                },
                            },
                            in: "$$exchange.totalAmount",
                        },
                    },
                    0,
                ],
            },
            user_import_amount: {
                $ifNull: [{ $arrayElemAt: ["$user_import.userImportAmount", 0] }, 0],
            },
            last_import_date: {
                $ifNull: [{ $arrayElemAt: ["$last_import.lastImportDate", 0] }, null],
            },
        },
    });

    const users = await UserModel.aggregate(aggregation);

    const blockIps = await BlockIpModel.find();
    const blockIpSet = new Set(blockIps.map((ip) => ip.ip_address));

    const result = users.map((user) => ({
        ...user,
        blockedIp: user.last_login_history
            ? blockIpSet.has(user.last_login_history.ip_address)
            : false,
    }));

    responseSuccess(res, result);
};
