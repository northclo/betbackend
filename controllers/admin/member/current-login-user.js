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

    // Aggregation
    const aggregation = [
        { $match: filter },
        {
            $addFields: {
                current_balance: { $ifNull: ["$current_balance", 0] },
                pending_addfund_balance: { $ifNull: ["$pending_addfund_balance", 0] },
                pending_refund_balance: { $ifNull: ["$pending_refund_balance", 0] },
            }
        },

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
            current_balance: 1,
            point: 1,
            ip: 1,
            createdAt: 1,
            own_partner: { $arrayElemAt: ["$own_partners", -1] },
            partner: { $arrayElemAt: ["$partners", -1] },
            last_login_history: { $arrayElemAt: ["$login_history", -1] },
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
