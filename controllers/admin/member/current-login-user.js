import mongoose from "mongoose";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import BlockIpModel from "../../../models/BlockIp.js";
import { responseSuccess, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

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
        case "user_id":
            return {
                $or: [
                    { user_name: regex },
                    { user_id_text: regex },
                ],
            };
        case "user_nickname":
            return { user_nickname: regex };
        case "partner":
            return { "partner.nickname": regex };
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
                    { user_id_text: regex },
                ],
            };
    }
};

export const getCurrentLoginUser = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        const {
            userStatus = '',
            searchField = '',
            search = '',
            page = 1,
            pageSize = 10,
            startDate = '',
            endDate = '',
        } = req.query;

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
        const skip = (pageNumber - 1) * limit;

        // Date filter
        const start = startDate ? normalizeDate(startDate) : null;
        const end = endDate ? normalizeDate(endDate, true) : null;
        const dateFilter = {};
        if (start || end) {
            if (start) dateFilter.$gte = start;
            if (end) dateFilter.$lte = end;
        }

        // Search filter
        const searchRegex = search && search.trim() ? new RegExp(search.trim(), "i") : null;
        const searchMatch = buildSearchMatch(searchField, searchRegex);

        // Get blocked IPs
        const blockedIps = await BlockIpModel.find({}).select("ip_address").lean();
        const blockedIpSet = new Set(blockedIps.map(b => b.ip_address));

        // User pipeline - filter by accessible users and login_status = true
        const userMatchStage = {};
        
        if (accessibleUserIds.length > 0) {
            userMatchStage._id = { $in: accessibleUserIds };
        } else {
            userMatchStage._id = { $in: [] };
        }

        // Filter by login_status = true (currently logged in)
        userMatchStage.login_status = true;

        // Filter by user status
        if (userStatus) {
            userMatchStage.user_status = userStatus;
        }

        const userPipeline = [
            { $match: userMatchStage },
            {
                $addFields: {
                    own_money: { $ifNull: ["$own_money", 0] },
                    point: { $ifNull: ["$point", 0] },
                    user_id_text: { $toString: "$_id" },
                },
            },
            {
                $lookup: {
                    from: "partners",
                    localField: "partner_id",
                    foreignField: "_id",
                    as: "partner_data",
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
                                fund_status: "COMPLETE",
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                totalImportAmount: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$fund_type", "CHARGE"] },
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
                                userImportAmount: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $eq: ["$fund_type", "CHARGE"] },
                                                    { $eq: ["$action_user_id", null] },
                                                ],
                                            },
                                            "$fund_amount",
                                            0,
                                        ],
                                    },
                                },
                                lastImportTime: {
                                    $max: {
                                        $cond: [
                                            { $eq: ["$fund_type", "CHARGE"] },
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
                    partner: {
                        $cond: {
                            if: { $gt: [{ $size: "$partner_data" }, 0] },
                            then: {
                                _id: { $arrayElemAt: ["$partner_data._id", 0] },
                                nickname: { $arrayElemAt: ["$partner_data.nickname", 0] },
                                partner_id: { $arrayElemAt: ["$partner_data.partner_id", 0] },
                                role: { $arrayElemAt: ["$partner_data.role", 0] },
                            },
                            else: null,
                        },
                    },
                    last_login_history: { $arrayElemAt: ["$login_history", 0] },
                    total_import_amount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalImportAmount", 0] }, 0],
                    },
                    total_exchange_amount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalExchangeAmount", 0] }, 0],
                    },
                    user_import_amount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.userImportAmount", 0] }, 0],
                    },
                    last_import_date: {
                        $arrayElemAt: ["$fund_stats.lastImportTime", 0],
                    },
                },
            },
        ];

        // Partner pipeline - filter by accessible partners
        // Note: We'll filter by login_status after checking linked user
        const partnerMatchStage = {};
        
        if (accessiblePartnerIds.length > 0) {
            partnerMatchStage._id = { $in: accessiblePartnerIds };
        } else {
            partnerMatchStage._id = { $in: [] };
        }

        // Filter by user status (if specified)
        if (userStatus) {
            partnerMatchStage.user_status = userStatus;
        }

        const partnerPipeline = [
            { $match: partnerMatchStage },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "linked_user",
                },
            },
            {
                $addFields: {
                    original_partner_id: "$_id",
                    user_id_text: null,
                    user_nickname: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.user_nickname", 0] },
                            else: "$nickname",
                        },
                    },
                    user_name: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.user_name", 0] },
                            else: "$partner_id",
                        },
                    },
                    user_status: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.user_status", 0] },
                            else: { $ifNull: ["$user_status", "normal"] },
                        },
                    },
                    login_status: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.login_status", 0] },
                            else: { $ifNull: ["$login_status", false] },
                        },
                    },
                    own_money: { $ifNull: ["$own_money", 0] },
                    point: { $ifNull: ["$point", 0] },
                    partner: "$$ROOT",
                    _id: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user._id", 0] },
                            else: {
                                $cond: {
                                    if: { $ne: ["$user_id", null] },
                                    then: "$user_id",
                                    else: "$_id",
                                },
                            },
                        },
                    },
                    createdAt: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.createdAt", 0] },
                            else: "$createdAt",
                        },
                    },
                },
            },
            {
                $match: {
                    login_status: true,
                },
            },
            {
                $lookup: {
                    from: "user_login_histories",
                    let: { partnerId: "$original_partner_id" },
                    pipeline: [
                        { 
                            $match: { 
                                $expr: { $eq: ["$user_id", "$$partnerId"] }
                            } 
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                    ],
                    as: "user_login_history",
                },
            },
            {
                $lookup: {
                    from: "partner_login_histories",
                    let: { partnerId: "$original_partner_id" },
                    pipeline: [
                        { 
                            $match: { 
                                $expr: { $eq: ["$partner_id", "$$partnerId"] }
                            } 
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                    ],
                    as: "partner_login_history",
                },
            },
            {
                $lookup: {
                    from: "transaction_histories",
                    let: { partnerId: "$original_partner_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { 
                                    $and: [
                                        { $eq: ["$user_id", "$$partnerId"] },
                                        { $eq: ["$fund_status", "COMPLETE"] }
                                    ]
                                },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                totalImportAmount: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$fund_type", "CHARGE"] },
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
                                userImportAmount: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $eq: ["$fund_type", "CHARGE"] },
                                                    { $eq: ["$action_user_id", null] },
                                                ],
                                            },
                                            "$fund_amount",
                                            0,
                                        ],
                                    },
                                },
                                lastImportTime: {
                                    $max: {
                                        $cond: [
                                            { $eq: ["$fund_type", "CHARGE"] },
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
                    last_login_history: {
                        $cond: {
                            if: {
                                $and: [
                                    { $gt: [{ $size: "$user_login_history" }, 0] },
                                    { $gt: [{ $size: "$partner_login_history" }, 0] }
                                ]
                            },
                            then: {
                                $let: {
                                    vars: {
                                        userLogin: { $arrayElemAt: ["$user_login_history", 0] },
                                        partnerLogin: { $arrayElemAt: ["$partner_login_history", 0] }
                                    },
                                    in: {
                                        $cond: {
                                            if: {
                                                $gt: [
                                                    "$$userLogin.createdAt",
                                                    "$$partnerLogin.createdAt"
                                                ]
                                            },
                                            then: "$$userLogin",
                                            else: {
                                                createdAt: "$$partnerLogin.createdAt",
                                                ip_address: "$$partnerLogin.ip_address",
                                                location: "$$partnerLogin.location",
                                                device: "$$partnerLogin.device",
                                                mobile: "$$partnerLogin.mobile"
                                            }
                                        }
                                    }
                                }
                            },
                            else: {
                                $cond: {
                                    if: { $gt: [{ $size: "$user_login_history" }, 0] },
                                    then: { $arrayElemAt: ["$user_login_history", 0] },
                                    else: {
                                        $cond: {
                                            if: { $gt: [{ $size: "$partner_login_history" }, 0] },
                                            then: {
                                                $let: {
                                                    vars: {
                                                        partnerLogin: { $arrayElemAt: ["$partner_login_history", 0] }
                                                    },
                                                    in: {
                                                        createdAt: "$$partnerLogin.createdAt",
                                                        ip_address: "$$partnerLogin.ip_address",
                                                        location: "$$partnerLogin.location",
                                                        device: "$$partnerLogin.device",
                                                        mobile: "$$partnerLogin.mobile"
                                                    }
                                                }
                                            },
                                            else: null
                                        }
                                    }
                                }
                            }
                        }
                    },
                    total_import_amount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalImportAmount", 0] }, 0],
                    },
                    total_exchange_amount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalExchangeAmount", 0] }, 0],
                    },
                    user_import_amount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.userImportAmount", 0] }, 0],
                    },
                    last_import_date: {
                        $arrayElemAt: ["$fund_stats.lastImportTime", 0],
                    },
                    partner: {
                        _id: "$partner._id",
                        nickname: "$partner.nickname",
                        partner_id: "$partner.partner_id",
                        role: "$partner.role",
                    },
                },
            },
        ];

        // Apply search filter to user pipeline
        if (searchMatch) {
            userPipeline.push({ $match: searchMatch });
        }

        // Apply search filter to partner pipeline
        if (searchMatch) {
            partnerPipeline.push({ $match: searchMatch });
        }

        // Apply date filter to user pipeline
        if (Object.keys(dateFilter).length > 0) {
            userPipeline.push({
                $match: {
                    $or: [
                        { "last_login_history.createdAt": dateFilter },
                        { last_import_date: dateFilter },
                    ],
                },
            });
        }

        // Apply date filter to partner pipeline
        if (Object.keys(dateFilter).length > 0) {
            partnerPipeline.push({
                $match: {
                    $or: [
                        { "last_login_history.createdAt": dateFilter },
                        { last_import_date: dateFilter },
                    ],
                },
            });
        }

        // Add blocked IP flag to user pipeline
        userPipeline.push({
            $addFields: {
                blockedIp: {
                    $cond: {
                        if: {
                            $and: [
                                { $ne: ["$last_login_history", null] },
                                { $ne: ["$last_login_history.ip_address", null] },
                            ],
                        },
                        then: {
                            $in: ["$last_login_history.ip_address", Array.from(blockedIpSet)],
                        },
                        else: false,
                    },
                },
            },
        });

        // Add blocked IP flag to partner pipeline
        partnerPipeline.push({
            $addFields: {
                blockedIp: {
                    $cond: {
                        if: {
                            $and: [
                                { $ne: ["$last_login_history", null] },
                                { $ne: ["$last_login_history.ip_address", null] },
                            ],
                        },
                        then: {
                            $in: ["$last_login_history.ip_address", Array.from(blockedIpSet)],
                        },
                        else: false,
                    },
                },
            },
        });

        // Combine user and partner pipelines
        const combinedPipeline = [
            ...userPipeline,
            {
                $unionWith: {
                    coll: "partners",
                    pipeline: partnerPipeline,
                },
            },
        ];

        // Count and paginate
        const countPipeline = [...combinedPipeline, { $count: "count" }];
        const dataPipeline = [
            ...combinedPipeline,
            { $sort: { "last_login_history.createdAt": -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    _id: 1,
                    user_id: {
                        $cond: {
                            if: { $ne: ["$user_id_text", null] },
                            then: "$user_id_text",
                            else: null,
                        },
                    },
                    user_nickname: {
                        $cond: {
                            if: { $ne: ["$user_nickname", null] },
                            then: "$user_nickname",
                            else: null,
                        },
                    },
                    partner: {
                        $cond: {
                            if: { $ne: ["$partner", null] },
                            then: {
                                _id: "$partner._id",
                                nickname: "$partner.nickname",
                                partner_id: "$partner.partner_id",
                                role: "$partner.role",
                            },
                            else: null,
                        },
                    },
                    own_money: 1,
                    point: 1,
                    total_import_amount: 1,
                    total_exchange_amount: 1,
                    user_import_amount: 1,
                    last_import_date: 1,
                    last_login_history: {
                        $cond: {
                            if: { $ifNull: ["$last_login_history", false] },
                            then: {
                                ip_address: "$last_login_history.ip_address",
                                location: "$last_login_history.location",
                                device: "$last_login_history.device",
                                mobile: "$last_login_history.mobile",
                                createdAt: "$last_login_history.createdAt",
                            },
                            else: null,
                        },
                    },
                    blockedIp: 1,
                    createdAt: 1,
                },
            },
        ];

        const [countResult, dataResult] = await Promise.all([
            UserModel.aggregate(countPipeline),
            UserModel.aggregate(dataPipeline),
        ]);

        const total = countResult[0]?.count || 0;
        const list = dataResult || [];

        return responseSuccess(res, {
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

