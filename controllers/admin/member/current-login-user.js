import mongoose from "mongoose";

import UserModel from "../../../models/User.js";
import { responseSuccess, responseServerError } from "../../../helper/response.js";
import { onlineUsers } from "../../../server.js";

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

const buildSearchMatch = (field, regex) => {
    if (!regex || !field) return null;

    switch (field) {
        case "user_nickname":
            return { user_nickname: regex };
        case "user_id":
            return {
                $or: [
                    { user_name: regex },
                    { user_email: regex },
                    { user_id_text: regex },
                ],
            };
        case "partner":
            return {
                $or: [
                    { "own_partner.nickname": regex },
                    { "own_partner.partner_id": regex },
                    { "partner.nickname": regex },
                    { "partner.partner_id": regex },
                ],
            };
        case "ip_address":
            return { "last_login_history.ip_address": regex };
        case "location":
            return { "last_login_history.location": regex };
        case "organ":
            return { "last_login_history.device": regex };
        default:
            return {
                $or: [
                    { user_nickname: regex },
                    { user_name: regex },
                    { user_email: regex },
                    { user_id_text: regex },
                    { "own_partner.nickname": regex },
                    { "partner.nickname": regex },
                    { "last_login_history.ip_address": regex },
                    { "last_login_history.location": regex },
                    { "last_login_history.device": regex },
                ],
            };
    }
};

export const getCurrentLoginUser = async (req, res) => {
    try {
        const {
            startDate: startDateParam,
            endDate: endDateParam,
            searchField: searchFieldParam,
            search: searchValue = "",
            userStatus = "",
            page = 1,
            pageSize = 10,
            start_date,
            end_date,
            search_field,
            user_status,
        } = req.query;

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
        const skip = (pageNumber - 1) * limit;

        const startDate = startDateParam || start_date;
        const endDate = endDateParam || end_date;
        const searchField = searchFieldParam || search_field || "";
        const statusFilter = userStatus || user_status || "";

        const start = startDate ? normalizeDate(startDate) : null;
        const end = endDate ? normalizeDate(endDate, true) : null;

        const onlineUserIds = Array.from(onlineUsers.keys())
            .map((id) => {
                try {
                    return new mongoose.Types.ObjectId(id);
                } catch {
                    return null;
                }
            })
            .filter(Boolean);

        let userIdsToQuery = onlineUserIds;
        if (!onlineUserIds.length) {
            const dbOnlineUsers = await UserModel.find(
                { login_status: true },
                { _id: 1 }
            ).lean();
            userIdsToQuery = dbOnlineUsers.map((u) => u._id);
            
            if (!userIdsToQuery.length) {
                return responseSuccess(res, {
                    list: [],
                    total: 0,
                    page: pageNumber,
                    pageSize: limit,
                });
            }
        }

        const matchStage = {
            _id: { $in: userIdsToQuery },
        };

        if (statusFilter) {
            matchStage.user_status = statusFilter;
        }

        const searchRegex = searchValue && searchValue.trim() ? new RegExp(searchValue.trim(), "i") : null;

        const basePipeline = [
            { $match: matchStage },
            {
                $addFields: {
                own_money: { $ifNull: ["$own_money", 0] },
                point: { $ifNull: ["$point", 0] },
                pending_addfund_balance: { $ifNull: ["$pending_addfund_balance", 0] },
                pending_refund_balance: { $ifNull: ["$pending_refund_balance", 0] },
            },
        },
        {
            $lookup: {
                from: "partners",
                localField: "own_partner_id",
                foreignField: "_id",
                as: "own_partner",
            },
        },
        {
            $lookup: {
                from: "partners",
                localField: "partner_id",
                foreignField: "_id",
                as: "partner",
            },
        },
        {
            $lookup: {
                from: "user_login_histories",
                let: { uid: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$user_id", "$$uid"] } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 1 },
                ],
                as: "login_history",
            },
        },
        {
            $lookup: {
                from: "transaction_histories",
                let: { uid: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$user_id", "$$uid"] },
                            fund_status: "APPROVED",
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalImportAmount: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$fund_type", "IMPORT"] },
                                        "$fund_amount",
                                        0,
                                    ],
                                },
                            },
                            totalExchangeAmount: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$fund_type", "EXCHANGE"] },
                                        "$fund_amount",
                                        0,
                                    ],
                                },
                            },
                            lastImportTime: {
                                $max: {
                                    $cond: [
                                        { $eq: ["$fund_type", "IMPORT"] },
                                        "$createdAt",
                                        null,
                                    ],
                                },
                            },
                        },
                    },
                ],
                as: "fund_stats",
            },
        },
        {
            $addFields: {
                own_partner: { $arrayElemAt: ["$own_partner", 0] },
                partner: { $arrayElemAt: ["$partner", 0] },
                last_login_history: { $arrayElemAt: ["$login_history", 0] },
                total_import_amount: {
                    $ifNull: [{ $arrayElemAt: ["$fund_stats.totalImportAmount", 0] }, 0],
                },
                total_exchange_amount: {
                    $ifNull: [{ $arrayElemAt: ["$fund_stats.totalExchangeAmount", 0] }, 0],
                },
                last_import_time: {
                    $arrayElemAt: ["$fund_stats.lastImportTime", 0],
                },
                user_import_amount: { $ifNull: ["$pending_addfund_balance", 0] },
                user_id_text: { $toString: "$_id" },
                },
            },
        ];

        if (start || end) {
            const dateFilter = {};
            if (start) {
                dateFilter.$gte = start;
            }
            if (end) {
                dateFilter.$lte = end;
            }
            basePipeline.push({
                $match: {
                    $or: [
                        { "last_login_history.createdAt": dateFilter },
                        { "last_login_history": { $exists: false } },
                        { "last_login_history": null }
                    ]
                },
            });
        }

        const searchMatch = buildSearchMatch(searchField, searchRegex);
        if (searchMatch) {
            basePipeline.push({ $match: searchMatch });
        }

        basePipeline.push({
            $project: {
                login_history: 0,
                fund_stats: 0,
            },
        });

        const aggregation = await UserModel.aggregate([
            ...basePipeline,
            {
                $facet: {
                    data: [
                        { $sort: { "last_login_history.createdAt": -1, createdAt: -1 } },
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $lookup: {
                                from: "block_ips",
                                let: { ip: "$last_login_history.ip_address" },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: { $eq: ["$ip_address", "$$ip"] },
                                        },
                                    },
                                    { $project: { _id: 1 } },
                                ],
                                as: "blocked_entries",
                            },
                        },
                        {
                            $addFields: {
                                blockedIp: { $gt: [{ $size: "$blocked_entries" }, 0] },
                                last_login_history: {
                                    $cond: [
                                        { $ifNull: ["$last_login_history", false] },
                                        {
                                            ip_address: "$last_login_history.ip_address",
                                            location: "$last_login_history.location",
                                            device: "$last_login_history.device",
                                            mobile: "$last_login_history.mobile",
                                            createdAt: {
                                                $dateToString: {
                                                    format: "%Y-%m-%dT%H:%M:%S.%LZ",
                                                    date: "$last_login_history.createdAt",
                                                },
                                            },
                                        },
                                        null,
                                    ],
                                },
                                createdAt: {
                                    $dateToString: {
                                        format: "%Y-%m-%dT%H:%M:%S.%LZ",
                                        date: "$createdAt",
                                    },
                                },
                                last_import_date: {
                                    $cond: [
                                        { $ifNull: ["$last_import_time", false] },
                                        {
                                            $dateToString: {
                                                format: "%Y-%m-%dT%H:%M:%S.%LZ",
                                                date: "$last_import_time",
                                            },
                                        },
                                        null,
                                    ],
                                },
                            },
                        },
                        {
                            $project: {
                                blocked_entries: 0,
                                last_import_time: 0,
                            },
                        },
                        {
                            $project: {
                                key: { $toString: "$_id" },
                                user_id: "$user_id_text",
                                user_nickname: 1,
                                user_status: 1,
                                own_money: 1,
                                point: 1,
                                own_partner: {
                                    partner_id: "$own_partner.partner_id",
                                    nickname: "$own_partner.nickname",
                                    role: "$own_partner.role",
                                },
                                partner: {
                                    partner_id: "$partner.partner_id",
                                    nickname: "$partner.nickname",
                                    role: "$partner.role",
                                },
                                last_login_history: 1,
                                total_import_amount: 1,
                                total_exchange_amount: 1,
                                user_import_amount: 1,
                                last_import_date: 1,
                                createdAt: 1,
                                blockedIp: 1,
                            },
                        },
                    ],
                    total: [
                        { $count: "count" },
                    ],
            },
        },
    ]);

        const list = aggregation[0]?.data || [];
        const total = aggregation[0]?.total?.[0]?.count || 0;

        responseSuccess(res, {
            list,
            total,
            page: pageNumber,
            pageSize: limit,
        });
    } catch (error) {
        console.error("Error in getCurrentLoginUser:", error);
        return responseServerError(res);
    }
};
