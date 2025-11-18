import mongoose from "mongoose";
import TransactionModel from "../../../models/TransactionHistory.js";
import BettingResultModel from "../../../models/BettingResult.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

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
    let {
        startDate,
        endDate,
        type,
        member,
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
    let bettingDateFilter = {};
    if (start || end) {
        dateFilter.createdAt = {};
        if (start) dateFilter.createdAt.$gte = start;
        if (end) dateFilter.createdAt.$lte = end;
        
        const createdAtCondition = {};
        const updatedAtCondition = {};
        
        if (start && end) {
            createdAtCondition.createdAt = { $gte: start, $lte: end };
            updatedAtCondition.updatedAt = { $gte: start, $lte: end };
        } else if (start) {
            createdAtCondition.createdAt = { $gte: start };
            updatedAtCondition.updatedAt = { $gte: start };
        } else if (end) {
            createdAtCondition.createdAt = { $lte: end };
            updatedAtCondition.updatedAt = { $lte: end };
        }
        
        bettingDateFilter.$or = [
            createdAtCondition,
            updatedAtCondition
        ];
    }

    let transactionTypeFilter = {};
    let bettingTypeFilter = {};
    
    if (type && type !== 'all') {
        if (type === 'charge') {
            transactionTypeFilter.fund_type = 'IMPORT';
            bettingTypeFilter = { _id: { $exists: false } }; 
        } else if (type === 'exchange') {
            transactionTypeFilter.fund_type = 'EXCHANGE';
            bettingTypeFilter = { _id: { $exists: false } }; 
        } else if (type === 'bet') {
            transactionTypeFilter = { _id: { $exists: false } };
        }
    }

    let memberFilter = {};
    let bettingMemberFilter = {};
    
    if (member) {
        const memberRegex = new RegExp(member, 'i');
        const users = await UserModel.find({
            $or: [
                { user_nickname: memberRegex },
                { user_email: memberRegex },
                { _id: member }
            ]
        }).select('_id').lean();
        
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
            memberFilter.user_id = { $in: userIds };
            bettingMemberFilter.user_id = { $in: userIds };
        } else {
            memberFilter.user_id = { $exists: false };
            bettingMemberFilter.user_id = { $exists: false };
        }
    }

    const transactionFilter = {
        ...dateFilter,
        ...transactionTypeFilter,
        ...memberFilter,
        fund_type: { $in: ['IMPORT', 'EXCHANGE'] }
    };

    const bettingFilter = {
        ...(Object.keys(bettingDateFilter).length > 0 && bettingDateFilter.$or.length > 0 ? bettingDateFilter : dateFilter),
        ...bettingMemberFilter,
        ...bettingTypeFilter
    };

    const transactions = await TransactionModel.aggregate([
        {
            $match: transactionFilter
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
                localField: "processed_by",
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
                transaction_id: {
                    $concat: [
                        { $switch: {
                            branches: [
                                { case: { $eq: ["$fund_type", "IMPORT"] }, then: "CHG-" },
                                { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "EX-" }
                            ],
                            default: "TX-"
                        }},
                        { $toString: "$_id" }
                    ]
                },
                member: {
                    $ifNull: [
                        { $concat: ["user_", { $toString: "$user._id" }] },
                        "-"
                    ]
                },
                member_nickname: { $ifNull: ["$user.user_nickname", "-"] },
                type: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$fund_type", "IMPORT"] }, then: "charge" },
                            { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "exchange" }
                        ],
                        default: "charge"
                    }
                },
                amount: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$fund_type", "IMPORT"] }, then: "$fund_amount" },
                            { 
                                case: { $eq: ["$fund_type", "EXCHANGE"] }, 
                                then: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$fund_status", "PENDING"] }, then: { $multiply: ["$fund_amount", -1] } },
                                            { case: { $eq: ["$fund_status", "APPROVED"] }, then: { $multiply: ["$fund_amount", -1] } },
                                            { case: { $eq: ["$fund_status", "REJECTED"] }, then: 0 }
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
                                { case: { $eq: ["$fund_type", "IMPORT"] }, then: "Charge" },
                                { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "Exchange" }
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
                                date: "$processed_at"
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
        }
    ]);

    const bettingTransactions = await BettingResultModel.aggregate([
        {
            $match: bettingFilter
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
            $addFields: {
                user: { $arrayElemAt: ["$user", 0] }
            }
        },
        {
            $project: {
                _id: { $toString: "$_id" },
                transaction_id: {
                    $concat: ["BET-", { $toString: "$_id" }]
                },
                member: {
                    $ifNull: [
                        { $concat: ["user_", { $toString: "$user._id" }] },
                        "-"
                    ]
                },
                member_nickname: { $ifNull: ["$user.user_nickname", "-"] },
                type: "bet",
                amount: {
                    $switch: {
                        branches: [
                            { 
                                case: { $eq: ["$betting_status", "complete"] },
                                then: {
                                    $subtract: [
                                        { $ifNull: ["$earning_amount", 0] },
                                        { $ifNull: ["$bet_amount", 0] }
                                    ]
                                }
                            },
                            { 
                                case: { $eq: ["$betting_status", "cancel"] },
                                then: 0
                            },
                            { 
                                case: { $in: ["$betting_status", ["wait", "progress"]] },
                                then: { $multiply: [{ $ifNull: ["$bet_amount", 0] }, -1] }
                            }
                        ],
                        default: { $multiply: [{ $ifNull: ["$bet_amount", 0] }, -1] }
                    }
                },
                bet_amount: "$bet_amount",
                earning_amount: "$earning_amount",
                betting_status: "$betting_status",
                win: "$win",
                game_id: "$game_id",
                description: {
                    $concat: [
                        "Bet ",
                        { $ifNull: ["$game_id", ""] },
                        " - ",
                        {
                            $cond: {
                                if: { $eq: ["$betting_status", "complete"] },
                                then: {
                                    $cond: {
                                        if: { $eq: ["$win", true] },
                                        then: "Won",
                                        else: "Lost"
                                    }
                                },
                                else: "$betting_status"
                            }
                        }
                    ]
                },
                processed_at: {
                    $dateToString: {
                        format: "%Y-%m-%d %H:%M",
                        date: {
                            $ifNull: ["$updatedAt", "$createdAt"]
                        }
                    }
                },
                createdAt: "$createdAt",
                sortDate: {
                    $ifNull: ["$updatedAt", "$createdAt"]
                }
            }
        }
    ]);

    let allTransactions = [...transactions, ...bettingTransactions];
    
    allTransactions.sort((a, b) => {
        const dateA = new Date(a.sortDate);
        const dateB = new Date(b.sortDate);
        return dateB - dateA;
    });

    const userIds = [...new Set(allTransactions.map(tx => tx.member.replace('user_', '')))].filter(id => id !== '-');
    
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
                const transactionsAfter = await TransactionModel.aggregate([
                    {
                        $match: {
                            user_id: { $in: userObjectIds },
                            createdAt: { $gt: end }
                        }
                    },
                    {
                        $group: {
                            _id: "$user_id",
                            totalAmount: {
                                $sum: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$fund_type", "IMPORT"] }, then: "$fund_amount" },
                                            { 
                                                case: { $eq: ["$fund_type", "EXCHANGE"] },
                                                then: {
                                                    $switch: {
                                                        branches: [
                                                            { case: { $eq: ["$fund_status", "PENDING"] }, then: { $multiply: ["$fund_amount", -1] } },
                                                            { case: { $eq: ["$fund_status", "APPROVED"] }, then: { $multiply: ["$fund_amount", -1] } },
                                                            { case: { $eq: ["$fund_status", "REJECTED"] }, then: 0 }
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
                
                const bettingAfter = await BettingResultModel.aggregate([
                    {
                        $match: {
                            user_id: { $in: userObjectIds },
                            $or: [
                                { createdAt: { $gt: end } },
                                { updatedAt: { $gt: end } }
                            ]
                        }
                    },
                    {
                        $group: {
                            _id: "$user_id",
                            totalAmount: {
                                $sum: {
                                    $switch: {
                                        branches: [
                                            { 
                                                case: { $eq: ["$betting_status", "complete"] },
                                                then: {
                                                    $subtract: [
                                                        { $ifNull: ["$earning_amount", 0] },
                                                        { $ifNull: ["$bet_amount", 0] }
                                                    ]
                                                }
                                            },
                                            { 
                                                case: { $eq: ["$betting_status", "cancel"] },
                                                then: 0
                                            },
                                            { 
                                                case: { $in: ["$betting_status", ["wait", "progress"]] },
                                                then: { $multiply: [{ $ifNull: ["$bet_amount", 0] }, -1] }
                                            }
                                        ],
                                        default: { $multiply: [{ $ifNull: ["$bet_amount", 0] }, -1] }
                                    }
                                }
                            }
                        }
                    }
                ]);
                
                bettingAfter.forEach(item => {
                    const userId = item._id.toString();
                    if (transactionsAfterEnd[userId] !== undefined) {
                        transactionsAfterEnd[userId] += item.totalAmount || 0;
                    }
                });
            }
        }
    }

    const chronological = [...allTransactions].sort((a, b) => {
        const dateA = new Date(a.sortDate);
        const dateB = new Date(b.sortDate);
        return dateA - dateB;
    });
    
    const userTransactions = {};
    chronological.forEach(tx => {
        const userId = tx.member.replace('user_', '');
        if (userId === '-' || !mongoose.Types.ObjectId.isValid(userId)) return;
        
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
};

