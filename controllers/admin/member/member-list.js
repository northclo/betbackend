import mongoose from "mongoose";
import moment from "moment";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import PartnerMessageModel from "../../../models/PartnerMessage.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import BettingResultModel from "../../../models/BettingResult.js";
import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import { responseSuccess, responseServerError, responseUnAutherized, responseBadRequest } from "../../../helper/response.js";
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
        case "memo":
            return { memo_note: regex };
        case "bank_owner":
            return { bank_owner_name: regex };
        case "phone_number":
            return {
                $or: [
                    { "phone_number.phone_number_1": regex },
                    { "phone_number.phone_number_2": regex },
                ],
            };
        case "bank_account":
            return { bank_number: regex };
        case "recommended_user":
            return { recommend_id: regex };
        case "cash_remained_over":
            return { own_money: { $gte: parseFloat(regex.source.replace(/[^0-9.]/g, '')) || 0 } };
        case "cash_remained_under":
            return { own_money: { $lte: parseFloat(regex.source.replace(/[^0-9.]/g, '')) || 0 } };
        default:
            return {
                $or: [
                    { user_nickname: regex },
                    { user_name: regex },
                    { user_id_text: regex },
                    { memo_note: regex },
                ],
            };
    }
};

const buildSortStage = (sortValue) => {
    if (!sortValue) return { createdAt: -1 };
    
    const [field, direction] = sortValue.includes(':') 
        ? sortValue.split(':') 
        : [sortValue, 'desc'];
    
    const sortDir = direction?.toLowerCase() === 'asc' ? 1 : -1;
    
    const sortMap = {
        'created_date': 'createdAt',
        'owned_money': 'own_money',
        'owned_point': 'point',
        'connect_date': 'login_history.createdAt',
        'import_money': 'totalImportAmount',
        'exchange_money': 'totalExchangeAmount',
    };
    
    const sortField = sortMap[field] || field;
    return { [sortField]: sortDir };
};

const getDateFilterForDuration = (duration, startDate, endDate) => {
    const start = startDate ? normalizeDate(startDate) : null;
    const end = endDate ? normalizeDate(endDate, true) : null;
    
    if (!start && !end) return null;
    
    const dateFilter = {};
    if (start) dateFilter.$gte = start;
    if (end) dateFilter.$lte = end;
    
    switch (duration) {
        case 'created_date':
            return { createdAt: dateFilter };
        case 'connected_date':
            return { 'login_history.createdAt': dateFilter };
        case 'last_import_date':
            return { last_import_time: dateFilter };
        case 'password_changed_date':
            return { password_change_time: dateFilter };
        case 'import_exchange_betting':
        default:
            return {
                $or: [
                    { last_import_time: dateFilter },
                    { 'login_history.createdAt': dateFilter },
                ],
            };
    }
};

export const getMemberList = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        const {
            duration = 'import_exchange_betting',
            userStatus = '',
            searchField = '',
            search = '',
            sort: sortParam = 'created_date:desc',
            page = 1,
            pageSize = 10,
            partnerId = '',
            includeSubPartners = false,
            startDate = '',
            endDate = '',
        } = req.query;

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
        const skip = (pageNumber - 1) * limit;
        console.log(partnerId)
        let filterPartnerIds = [];
        if (partnerId) {
            const includeSubs = includeSubPartners === 'true' || includeSubPartners === true;
            
            const requestedPartner = await PartnerModel.findOne({ partner_id: partnerId }).select("_id").lean();
            if (!requestedPartner) {
                filterPartnerIds = [];
            } else {
                const isAccessible = accessiblePartnerIds.some(id => id.toString() === requestedPartner._id.toString());
                
                if (isAccessible) {
                    if (includeSubs) {
                        const subPartnerIds = await fetchAccessiblePartnerIds(requestedPartner._id);
                        filterPartnerIds = subPartnerIds;
                    } else {
                        filterPartnerIds = [requestedPartner._id];
                    }
                } else {
                    filterPartnerIds = [];
                }
            }
        } else {
            filterPartnerIds = accessiblePartnerIds;
        }

        const userMatchStage = {};
        
        if (accessibleUserIds.length > 0) {
            userMatchStage._id = { $in: accessibleUserIds };
        } else {
            return responseSuccess(res, {
                list: [],
                total: 0,
                page: pageNumber,
                pageSize: limit,
                statusCounts: {
                    all: 0,
                    normal: 0,
                    wait: 0,
                    stop: 0,
                    cancel: 0,
                    danger: 0,
                    tester: 0,
                },
            });
        }

        if (filterPartnerIds.length > 0) {
            userMatchStage.$or = [
                { partner_id: { $in: filterPartnerIds } },
                { ownpartner_id: { $in: filterPartnerIds } },
            ];
        }

        if (userStatus) {
            userMatchStage.user_status = userStatus;
        }

        const searchRegex = search && search.trim() ? new RegExp(search.trim(), "i") : null;
        const searchMatch = buildSearchMatch(searchField, searchRegex);

        const dateFilter = getDateFilterForDuration(duration, startDate, endDate);

        const basePipeline = [
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
                $lookup: {
                    from: "betting_results",
                    let: { uid: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$user_id", "$$uid"] },
                                betting_status: { $ne: "CANCEL" },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                totalBettingAmount: { $sum: "$bet_amount" },
                                totalWinCount: {
                                    $sum: {
                                        $cond: [{ $eq: ["$win", true] }, 1, 0],
                                    },
                                },
                                totalEarningAmount: { $sum: "$earning_amount" },
                            },
                        },
                    ],
                    as: "betting_stats",
                },
            },
            {
                $addFields: {
                    partner: null,
                    login_history: { $arrayElemAt: ["$login_history", 0] },
                    totalImportAmount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalImportAmount", 0] }, 0],
                    },
                    totalExchangeAmount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalExchangeAmount", 0] }, 0],
                    },
                    last_import_time: {
                        $arrayElemAt: ["$fund_stats.lastImportTime", 0],
                    },
                    totalBettingAmount: {
                        $ifNull: [{ $arrayElemAt: ["$betting_stats.totalBettingAmount", 0] }, 0],
                    },
                    totalWinCount: {
                        $ifNull: [{ $arrayElemAt: ["$betting_stats.totalWinCount", 0] }, 0],
                    },
                    totalEarningAmount: {
                        $ifNull: [{ $arrayElemAt: ["$betting_stats.totalEarningAmount", 0] }, 0],
                    },
                },
            },
        ];

        if (searchMatch) {
            basePipeline.push({ $match: searchMatch });
        }

        if (dateFilter) {
            basePipeline.push({ $match: dateFilter });
        }

        const partnerMatchStage = {};
        
        if (filterPartnerIds.length > 0) {
            partnerMatchStage._id = { $in: filterPartnerIds };
        } else if (accessiblePartnerIds.length > 0) {
            partnerMatchStage._id = { $in: accessiblePartnerIds };
        } else {
            partnerMatchStage._id = { $in: [] };
        }

        const partnerPipeline = [
            { 
                $match: partnerMatchStage,
            },
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
                    user_id_text: null,
                    user_nickname: null,
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
                            else: false,
                        },
                    },
                    own_money: { $ifNull: ["$own_money", 0] },
                    point: { $ifNull: ["$point", 0] },
                    memo_note: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.memo_note", 0] },
                            else: "",
                        },
                    },
                    bank_owner_name: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.bank_owner_name", 0] },
                            else: "$bank_owner_name",
                        },
                    },
                    phone_number: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.phone_number", 0] },
                            else: "$phone_number",
                        },
                    },
                    bank_number: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.bank_number", 0] },
                            else: "$bank_number",
                        },
                    },
                    recommend_id: {
                        $cond: {
                            if: { $gt: [{ $size: "$linked_user" }, 0] },
                            then: { $arrayElemAt: ["$linked_user.recommend_id", 0] },
                            else: "",
                        },
                    },
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
                $lookup: {
                    from: "user_login_histories",
                    let: { uid: "$user_id" },
                    pipeline: [
                        { 
                            $match: { 
                                $expr: { 
                                    $and: [
                                        { $ne: ["$$uid", null] },
                                        { $eq: ["$user_id", "$$uid"] }
                                    ]
                                } 
                            } 
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                    ],
                    as: "login_history",
                },
            },
            {
                $lookup: {
                    from: "transaction_histories",
                    let: { uid: "$user_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { 
                                    $and: [
                                        { $ne: ["$$uid", null] },
                                        { $eq: ["$user_id", "$$uid"] },
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
                $lookup: {
                    from: "betting_results",
                    let: { uid: "$user_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { 
                                    $and: [
                                        { $ne: ["$$uid", null] },
                                        { $eq: ["$user_id", "$$uid"] },
                                        { $ne: ["$betting_status", "CANCEL"] }
                                    ]
                                },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                totalBettingAmount: { $sum: "$bet_amount" },
                                totalWinCount: {
                                    $sum: {
                                        $cond: [{ $eq: ["$win", true] }, 1, 0],
                                    },
                                },
                                totalEarningAmount: { $sum: "$earning_amount" },
                            },
                        },
                    ],
                    as: "betting_stats",
                },
            },
            {
                $addFields: {
                    login_history: { $arrayElemAt: ["$login_history", 0] },
                    totalImportAmount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalImportAmount", 0] }, 0],
                    },
                    totalExchangeAmount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalExchangeAmount", 0] }, 0],
                    },
                    last_import_time: {
                        $arrayElemAt: ["$fund_stats.lastImportTime", 0],
                    },
                    totalBettingAmount: {
                        $ifNull: [{ $arrayElemAt: ["$betting_stats.totalBettingAmount", 0] }, 0],
                    },
                    totalWinCount: {
                        $ifNull: [{ $arrayElemAt: ["$betting_stats.totalWinCount", 0] }, 0],
                    },
                    totalEarningAmount: {
                        $ifNull: [{ $arrayElemAt: ["$betting_stats.totalEarningAmount", 0] }, 0],
                    },
                },
            },
        ];

        if (userStatus) {
            partnerPipeline.push({
                $match: {
                    user_status: userStatus,
                },
            });
        }

        if (searchMatch) {
            partnerPipeline.push({ $match: searchMatch });
        }

        if (dateFilter) {
            partnerPipeline.push({ $match: dateFilter });
        }

        const combinedPipeline = [
            ...basePipeline,
            {
                $unionWith: {
                    coll: "partners",
                    pipeline: partnerPipeline,
                },
            },
        ];

        combinedPipeline.push({
            $addFields: {
                totalPartnerEarning: {
                    $cond: {
                        if: { $and: [{ $ne: ["$partner", null] }, { $ne: ["$partner._id", null] }] },
                        then: {
                            $multiply: [
                                { $ifNull: ["$totalBettingAmount", 0] },
                                0.1,
                            ],
                        },
                        else: 0,
                    },
                },
            },
        });

        const sortStage = buildSortStage(sortParam);

        const aggregation = await UserModel.aggregate([
            ...combinedPipeline,
            {
                $facet: {
                    data: [
                        { $sort: sortStage },
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
                                partner_id: {
                                    $cond: {
                                        if: { $ne: ["$user_id_text", null] },
                                        then: null,
                                        else: {
                                            $cond: {
                                                if: { $ne: ["$partner", null] },
                                                then: "$partner.partner_id",
                                                else: null,
                                            },
                                        },
                                    },
                                },
                                user_name: 1,
                                user_nickname: 1,
                                user_status: 1,
                                login_status: 1,
                                own_money: 1,
                                point: 1,
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
                                totalImportAmount: 1,
                                totalExchangeAmount: 1,
                                totalPartnerEarning: 1,
                                totalBettingAmount: 1,
                                totalWinCount: 1,
                                totalEarningAmount: 1,
                                last_import_time: 1,
                                login_history: {
                                    $cond: {
                                        if: { $ifNull: ["$login_history", false] },
                                        then: {
                                            createdAt: "$login_history.createdAt",
                                            ip_address: "$login_history.ip_address",
                                        },
                                        else: null,
                                    },
                                },
                                createdAt: 1,
                            },
                        },
                    ],
                    total: [{ $count: "count" }],
                    statusCounts: [
                        {
                            $group: {
                                _id: null,
                                all: { $sum: 1 },
                                normal: {
                                    $sum: { $cond: [{ $eq: ["$user_status", "normal"] }, 1, 0] },
                                },
                                wait: {
                                    $sum: { $cond: [{ $eq: ["$user_status", "wait"] }, 1, 0] },
                                },
                                stop: {
                                    $sum: { $cond: [{ $eq: ["$user_status", "stop"] }, 1, 0] },
                                },
                                cancel: {
                                    $sum: { $cond: [{ $eq: ["$user_status", "cancel"] }, 1, 0] },
                                },
                                danger: {
                                    $sum: { $cond: [{ $eq: ["$user_status", "danger"] }, 1, 0] },
                                },
                                tester: {
                                    $sum: { $cond: [{ $eq: ["$user_status", "tester"] }, 1, 0] },
                                },
                            },
                        },
                    ],
                },
            },
        ]);

        const list = aggregation[0]?.data || [];
        const total = aggregation[0]?.total?.[0]?.count || 0;
        const statusCounts = aggregation[0]?.statusCounts?.[0] || {
            all: 0,
            normal: 0,
            wait: 0,
            stop: 0,
            cancel: 0,
            danger: 0,
            tester: 0,
        };

        return responseSuccess(res, {
            list,
            total,
            page: pageNumber,
            pageSize: limit,
            statusCounts,
        });
    } catch (error) {
        console.error("Error in getMemberList:", error);
        return responseServerError(res);
    }
};

export const updateMemberList = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const { _id, user_status, consider_user } = req.body;

        if (!_id) {
            return responseBadRequest(res, "User ID is required");
        }

        if (user_status === undefined && consider_user === undefined) {
            return responseBadRequest(res, "Either user_status or consider_user is required");
        }

        let userId;
        try {
            userId = new mongoose.Types.ObjectId(_id);
        } catch (error) {
            return responseBadRequest(res, "Invalid user ID format");
        }

        const updateData = {};
        if (user_status !== undefined) {
            updateData.user_status = user_status;
        }
        if (consider_user !== undefined) {
            updateData.consider_user = consider_user;
        }

        let user = await UserModel.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        );

        if (!user) {
            const partner = await PartnerModel.findByIdAndUpdate(
                userId,
                updateData,
                { new: true }
            );

            if (!partner) {
                return responseBadRequest(res, "User or Partner not found");
            }

            return responseSuccess(res, { 
                _id: partner._id, 
                user_status: partner.user_status,
                consider_user: partner.consider_user 
            }, "Partner updated successfully");
        }

        return responseSuccess(res, { 
            _id: user._id, 
            user_status: user.user_status,
            consider_user: user.consider_user 
        }, "User updated successfully");
    } catch (error) {
        console.error("Error in updateMemberList:", error);
        return responseServerError(res);
    }
};

export const createMemberList = async (req, res) => {
    return responseBadRequest(res, "Create member through partner registration endpoint");
};

export const deleteMemberList = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const { id } = req.params;

        if (!id) {
            return responseBadRequest(res, "User ID is required");
        }

        let userId;
        try {
            userId = new mongoose.Types.ObjectId(id);
        } catch (error) {
            return responseBadRequest(res, "Invalid user ID format");
        }

        const user = await UserModel.findByIdAndDelete(userId);

        if (!user) {
            return responseBadRequest(res, "User not found");
        }

        return responseSuccess(res, { _id: userId }, "User deleted successfully");
    } catch (error) {
        console.error("Error in deleteMemberList:", error);
        return responseServerError(res);
    }
};

export const getMemberById = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const { id } = req.query;

        if (!id) {
            return responseBadRequest(res, "User ID is required");
        }

        let userId;
        try {
            userId = new mongoose.Types.ObjectId(id);
        } catch (error) {
            return responseBadRequest(res, "Invalid user ID format");
        }

        const user = await UserModel.findById(userId)
            .populate('partner_id', 'nickname partner_id role')
            .populate('ownpartner_id', 'nickname partner_id role')
            .lean();

        if (!user) {
            return responseBadRequest(res, "User not found");
        }

        return responseSuccess(res, user);
    } catch (error) {
        console.error("Error in getMemberById:", error);
        return responseServerError(res);
    }
};

export const sendNotesToUsers = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const { userIds, title, content, sendToAll, expire } = req.body;

        if (!title || !title.trim()) {
            return responseBadRequest(res, "Title is required");
        }

        if (!content || !content.trim()) {
            return responseBadRequest(res, "Content is required");
        }

        let expireAt = null;
        if (expire && expire !== "0" && expire !== "::No period set::") {
            if (expire === "full moon" || expire === "moon") {
                expireAt = moment().endOf('month').valueOf();
            } else if (expire === "a week") {
                expireAt = moment().add(1, 'week').valueOf();
            } else if (expire === "month") {
                expireAt = moment().add(1, 'month').valueOf();
            } else {
                const parts = String(expire).trim().split(' ');
                if (parts.length >= 2) {
                    const amount = Number(parts[0]);
                    const unit = parts[1].toLowerCase();
                    
                    if (isNaN(amount) || amount <= 0) {
                        return responseBadRequest(res, "Invalid expire format");
                    }

                    const validUnits = ['minute', 'minutes', 'hour', 'hours', 'day', 'days', 'week', 'weeks', 'month', 'months'];
                    const normalizedUnit = unit.endsWith('s') ? unit : unit + 's';
                    
                    if (!validUnits.includes(normalizedUnit)) {
                        return responseBadRequest(res, "Invalid expire unit");
                    }

                    expireAt = moment().add(amount, normalizedUnit).valueOf();
                } else {
                    return responseBadRequest(res, "Invalid expire format");
                }
            }
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        let targetIds = [];

        if (sendToAll) {
            targetIds = [...accessibleUserIds, ...accessiblePartnerIds];
        } else {
            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return responseBadRequest(res, "User IDs are required");
            }

            const requestedIds = userIds.map(id => {
                try {
                    return new mongoose.Types.ObjectId(id);
                } catch (error) {
                    return null;
                }
            }).filter(Boolean);

            const validUserIds = requestedIds.filter(id => 
                accessibleUserIds.some(aid => aid.toString() === id.toString())
            );
            const validPartnerIds = requestedIds.filter(id => 
                accessiblePartnerIds.some(aid => aid.toString() === id.toString())
            );

            targetIds = [...validUserIds, ...validPartnerIds];

            if (targetIds.length === 0) {
                return responseBadRequest(res, "No accessible users or partners found");
            }
        }

        const message = await PartnerMessageModel.create({
            sender: adminId,
            receivers: targetIds,
            title: title.trim(),
            content: content.trim(),
            expire_at: expireAt
        });

        if (targetIds.length > 0) {
            try {
                const io = req.app.get("io");
                const onlineUsers = req.app.get("onlineUsers");
                
                if (io && onlineUsers) {
                    const sender = await PartnerModel.findById(adminId).select("nickname").lean();
                    const senderName = sender?.nickname || t("admin");
                    
                    const notificationData = {
                        messageId: message._id.toString(),
                        title: message.title,
                        content: message.content,
                        sender: senderName,
                        createdAt: message.createdAt,
                    };
                    
                    for (const receiverId of targetIds) {
                        const receiverIdStr = receiverId.toString();
                        const socketId = onlineUsers.get(receiverIdStr);
                        if (socketId) {
                            io.to(socketId).emit("new_group_message", notificationData);
                        }
                    }
                    
                    console.log(`Sent notes notification to all ${targetIds.length} receivers`);
                }
            } catch (socketError) {
                console.error("Error emitting socket event for notes:", socketError);
            }
        }

        return responseSuccess(res, {
            messageId: message._id,
            receiversCount: targetIds.length
        }, `Notes sent to ${targetIds.length} user(s)/partner(s) successfully`);
    } catch (error) {
        console.error("Error in sendNotesToUsers:", error);
        return responseServerError(res);
    }
};
