import mongoose from "mongoose";
import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
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

export const getMoneyUsageList = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        let {
            startDate,
            endDate,
            fund_type,
            fund_status,
            page = 1,
            pageSize = 10
        } = req.query;

        if (startDate && !normalizeDate(startDate)) {
            return responseBadRequest(res, t("invalid_start_date_format"));
        }
        if (endDate && !normalizeDate(endDate, true)) {
            return responseBadRequest(res, t("invalid_end_date_format"));
        }

        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate, true);
        
        if (start && end && start > end) {
            return responseBadRequest(res, t("start_date_before_or_equal_end_date"));
        }

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
        const skip = (pageNumber - 1) * limit;

        let dateFilter = {};
        if (start || end) {
            dateFilter.createdAt = {};
            if (start) dateFilter.createdAt.$gte = start;
            if (end) dateFilter.createdAt.$lte = end;
        }

        let typeFilter = {};
        if (fund_type && fund_type !== 'all') {
            if (fund_type === 'CHARGE') {
                typeFilter.fund_type = 'CHARGE';
            } else if (fund_type === 'EXCHANGE') {
                typeFilter.fund_type = 'EXCHANGE';
            } else if (fund_type === 'BETTING') {
                typeFilter.fund_type = 'BETTING';
            }
        } else {
            typeFilter.fund_type = { $in: ['CHARGE', 'EXCHANGE', 'BETTING'] };
        }

        let statusFilter = {};
        if (fund_status && fund_status !== 'all') {
            statusFilter.fund_status = fund_status;
        }

        const filter = {
            ...dateFilter,
            ...typeFilter,
            ...statusFilter
        };

        if (accessibleUserIds.length > 0) {
            filter.user_id = { $in: accessibleUserIds };
        } else {
            return responseSuccess(res, {
                list: [],
                total: 0,
                page: pageNumber,
                pageSize: limit
            });
        }

        const transactions = await TransactionModel.aggregate([
            {
                $match: filter
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "action_user_id",
                    foreignField: "_id",
                    as: "processor"
                }
            },
            {
                $addFields: {
                    user: { $arrayElemAt: ["$user", 0] },
                    processor: { $arrayElemAt: ["$processor", 0] }
                }
            },
            {
                $project: {
                    _id: { $toString: "$_id" },
                    user_id: { $toString: "$user_id" },
                    transaction_id: {
                        $concat: [
                            { $switch: {
                                branches: [
                                    { case: { $eq: ["$fund_type", "CHARGE"] }, then: "CHG-" },
                                    { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "EX-" },
                                    { case: { $eq: ["$fund_type", "BETTING"] }, then: "BET-" }
                                ],
                                default: "TX-"
                            }},
                            { $toString: "$_id" }
                        ]
                    },
                    member_nickname: { $ifNull: ["$user.user_nickname", "-"] },
                    type: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$fund_type", "CHARGE"] }, then: "charge" },
                                { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "exchange" },
                                { case: { $eq: ["$fund_type", "BETTING"] }, then: "betting" }
                            ],
                            default: "charge"
                        }
                    },
                    status: "$fund_status",
                    amount: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$fund_type", "CHARGE"] }, then: "$fund_amount" },
                                { 
                                    case: { $eq: ["$fund_type", "EXCHANGE"] }, 
                                    then: {
                                        $switch: {
                                            branches: [
                                                { case: { $eq: ["$fund_status", "COMPLETE"] }, then: { $multiply: ["$fund_amount", -1] } },
                                                { case: { $eq: ["$fund_status", "CANCEL"] }, then: 0 },
                                                { case: { $eq: ["$fund_status", "WAIT"] }, then: { $multiply: ["$fund_amount", -1] } }
                                            ],
                                            default: { $multiply: ["$fund_amount", -1] }
                                        }
                                    }
                                },
                                { 
                                    case: { $eq: ["$fund_type", "BETTING"] }, 
                                    then: {
                                        $switch: {
                                            branches: [
                                                { case: { $eq: ["$fund_status", "COMPLETE"] }, then: { $subtract: [{ $ifNull: ["$updated_amount", 0] }, "$fund_amount"] } },
                                                { case: { $eq: ["$fund_status", "CANCEL"] }, then: 0 },
                                                { case: { $in: ["$fund_status", ["WAIT"]] }, then: { $multiply: ["$fund_amount", -1] } }
                                            ],
                                            default: { $multiply: ["$fund_amount", -1] }
                                        }
                                    }
                                }
                            ],
                            default: "$fund_amount"
                        }
                    },
                    description: {
                        $concat: [
                            { $switch: {
                                branches: [
                                    { case: { $eq: ["$fund_type", "CHARGE"] }, then: "Charge" },
                                    { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "Exchange" },
                                    { case: { $eq: ["$fund_type", "BETTING"] }, then: "Betting" }
                                ],
                                default: "Transaction"
                            }},
                            " - ",
                            { $ifNull: ["$processor.user_nickname", "System"] }
                        ]
                    },
                    processed_at: {
                        $ifNull: [
                            {
                                $dateToString: {
                                    format: "%Y-%m-%d %H:%M",
                                    date: "$fund_status_update_date"
                                }
                            },
                            {
                                $dateToString: {
                                    format: "%Y-%m-%d %H:%M",
                                    date: "$createdAt"
                                }
                            }
                        ]
                    },
                    createdAt: "$createdAt",
                    sortDate: "$createdAt"
                }
            },
            {
                $sort: { sortDate: -1 }
            }
        ]);

        const userIds = [...new Set(transactions.map(tx => tx.user_id).filter(id => id && mongoose.Types.ObjectId.isValid(id)))];

        const userBalances = {};
        const transactionsAfterEnd = {};
        
        if (userIds.length > 0) {
            const userObjectIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
            
            if (userObjectIds.length > 0) {
                const users = await UserModel.find({
                    _id: { $in: userObjectIds }
                }).select('_id own_money').lean();
                
                users.forEach(user => {
                    userBalances[user._id.toString()] = user.own_money || 0;
                    transactionsAfterEnd[user._id.toString()] = 0;
                });
                
                if (end) {
                    const accessibleUserObjectIds = userObjectIds.filter(id => 
                        accessibleUserIds.some(aid => aid.toString() === id.toString())
                    );

                    const transactionsAfterFilter = {
                        user_id: { $in: accessibleUserObjectIds },
                        createdAt: { $gt: end }
                    };

                    const transactionsAfter = await TransactionModel.aggregate([
                        {
                            $match: transactionsAfterFilter
                        },
                        {
                            $group: {
                                _id: "$user_id",
                                totalAmount: {
                                    $sum: {
                                        $switch: {
                                            branches: [
                                                { case: { $eq: ["$fund_type", "CHARGE"] }, then: "$fund_amount" },
                                                { 
                                                    case: { $eq: ["$fund_type", "EXCHANGE"] },
                                                    then: {
                                                        $switch: {
                                                            branches: [
                                                                { case: { $eq: ["$fund_status", "COMPLETE"] }, then: { $multiply: ["$fund_amount", -1] } },
                                                                { case: { $eq: ["$fund_status", "CANCEL"] }, then: 0 },
                                                                { case: { $eq: ["$fund_status", "WAIT"] }, then: { $multiply: ["$fund_amount", -1] } }
                                                            ],
                                                            default: { $multiply: ["$fund_amount", -1] }
                                                        }
                                                    }
                                                },
                                                { 
                                                    case: { $eq: ["$fund_type", "BETTING"] },
                                                    then: {
                                                        $switch: {
                                                            branches: [
                                                                { case: { $eq: ["$fund_status", "COMPLETE"] }, then: { $subtract: [{ $ifNull: ["$updated_amount", 0] }, "$fund_amount"] } },
                                                                { case: { $eq: ["$fund_status", "CANCEL"] }, then: 0 },
                                                                { case: { $in: ["$fund_status", ["WAIT"]] }, then: { $multiply: ["$fund_amount", -1] } }
                                                            ],
                                                            default: { $multiply: ["$fund_amount", -1] }
                                                        }
                                                    }
                                                }
                                            ],
                                            default: 0
                                        }
                                    }
                                }
                            }
                        }
                    ]);
                    
                    transactionsAfter.forEach(item => {
                        const userId = item._id.toString();
                        if (transactionsAfterEnd[userId] !== undefined) {
                            transactionsAfterEnd[userId] = item.totalAmount || 0;
                        }
                    });
                }
            }
        }

        const chronological = [...transactions].sort((a, b) => {
            const dateA = new Date(a.sortDate);
            const dateB = new Date(b.sortDate);
            return dateA - dateB;
        });
        
        const userTransactions = {};
        chronological.forEach(tx => {
            const userId = tx.user_id;
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;
            
            if (!userTransactions[userId]) {
                userTransactions[userId] = [];
            }
            userTransactions[userId].push(tx);
        });
        
        Object.keys(userTransactions).forEach(userId => {
            const userTxs = userTransactions[userId];
            const currentBalance = userBalances[userId] || 0;
            const afterEndAmount = transactionsAfterEnd[userId] || 0;
            
            const balanceAtEnd = currentBalance - afterEndAmount;
            
            const totalImpact = userTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
            
            const balanceAtStart = balanceAtEnd - totalImpact;
            
            let runningBalance = balanceAtStart;
            userTxs.forEach(tx => {
                runningBalance += (tx.amount || 0);
                tx.balance_after = Math.round(runningBalance * 100) / 100;
            });
        });

        chronological.reverse();

        chronological.forEach(tx => {
            if (tx.balance_after === undefined || tx.balance_after === null) {
                tx.balance_after = null;
            }
        });

        const total = chronological.length;
        const paginatedData = chronological.slice(skip, skip + limit);

        responseSuccess(res, {
            list: paginatedData,
            total,
            page: pageNumber,
            pageSize: limit
        });
    } catch (error) {
        console.error("Error to get money usage list:", error);
        return responseServerError(res);
    }
};
