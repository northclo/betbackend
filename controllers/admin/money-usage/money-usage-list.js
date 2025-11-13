import mongoose from "mongoose";
import TransactionModel from "../../../models/TransactionHistory.js";
import BettingResultModel from "../../../models/BettingResult.js";
import UserModel from "../../../models/User.js";
import { responseSuccess } from "../../../helper/response.js";

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

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate, true);

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
    const skip = (pageNumber - 1) * limit;

    // Build date filter
    let dateFilter = {};
    if (start || end) {
        dateFilter.createdAt = {};
        if (start) dateFilter.createdAt.$gte = start;
        if (end) dateFilter.createdAt.$lte = end;
    }

    // Build type filter
    let transactionTypeFilter = {};
    let bettingTypeFilter = {};
    
    if (type && type !== 'all') {
        if (type === 'charge') {
            transactionTypeFilter.fund_type = 'IMPORT';
            bettingTypeFilter = { _id: { $exists: false } }; // Exclude betting
        } else if (type === 'exchange') {
            transactionTypeFilter.fund_type = 'EXCHANGE';
            bettingTypeFilter = { _id: { $exists: false } }; // Exclude betting
        } else if (type === 'bet') {
            transactionTypeFilter = { _id: { $exists: false } }; // Exclude transactions
            // Include all betting records
        }
    }

    // Build member filter
    let memberFilter = {};
    let bettingMemberFilter = {};
    
    if (member) {
        // Try to find user by nickname or ID
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
            // No users found, return empty result
            memberFilter.user_id = { $exists: false };
            bettingMemberFilter.user_id = { $exists: false };
        }
    }

    // Combine filters for transactions
    const transactionFilter = {
        ...dateFilter,
        ...transactionTypeFilter,
        ...memberFilter,
        fund_type: { $in: ['IMPORT', 'EXCHANGE', 'OUTGOING'] }
    };

    // Combine filters for betting
    const bettingFilter = {
        ...dateFilter,
        ...bettingMemberFilter,
        ...bettingTypeFilter
    };

    // Get transactions from TransactionHistory
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
                                { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "EX-" },
                                { case: { $eq: ["$fund_type", "OUTGOING"] }, then: "WD-" }
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
                            { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "exchange" },
                            { case: { $eq: ["$fund_type", "OUTGOING"] }, then: "withdrawal" }
                        ],
                        default: "charge"
                    }
                },
                amount: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$fund_type", "IMPORT"] }, then: "$fund_amount" },
                            { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "$fund_amount" },
                            { case: { $eq: ["$fund_type", "OUTGOING"] }, then: { $multiply: ["$fund_amount", -1] } }
                        ],
                        default: "$fund_amount"
                    }
                },
                description: {
                    $concat: [
                        { $switch: {
                            branches: [
                                { case: { $eq: ["$fund_type", "IMPORT"] }, then: "Charge" },
                                { case: { $eq: ["$fund_type", "EXCHANGE"] }, then: "Exchange" },
                                { case: { $eq: ["$fund_type", "OUTGOING"] }, then: "Withdrawal" }
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

    // Get betting transactions
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
                    $cond: {
                        if: { $eq: ["$betting_status", "complete"] },
                        then: {
                            $subtract: [
                                { $ifNull: ["$earning_amount", 0] },
                                { $ifNull: ["$bet_amount", 0] }
                            ]
                        },
                        else: { $multiply: [{ $ifNull: ["$bet_amount", 0] }, -1] }
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

    // Combine all transactions
    let allTransactions = [...transactions, ...bettingTransactions];
    
    // Sort by date (newest first) for pagination
    allTransactions.sort((a, b) => {
        const dateA = new Date(a.sortDate);
        const dateB = new Date(b.sortDate);
        return dateB - dateA;
    });

    // Calculate balance_after for filtered transactions
    // Get unique user IDs from transactions (convert MongoDB ObjectId strings to ObjectIds)
    const userIds = [...new Set(allTransactions.map(tx => tx.member.replace('user_', '')))].filter(id => id !== '-');
    
    // Get current balances and transactions after end date for these users
    const userBalances = {};
    const transactionsAfterEnd = {};
    
    if (userIds.length > 0) {
        const userObjectIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
        
        if (userObjectIds.length > 0) {
            // Get current balances
            const users = await UserModel.find({
                _id: { $in: userObjectIds }
            }).select('_id own_money').lean();
            
            users.forEach(user => {
                userBalances[user._id.toString()] = user.own_money || 0;
                transactionsAfterEnd[user._id.toString()] = 0;
            });
            
            // If we have an end date, get transactions after the end date to adjust balance
            if (end) {
                // Get transaction amounts after end date
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
                                    $cond: [
                                        { $eq: ["$fund_type", "IMPORT"] },
                                        "$fund_amount",
                                        { $cond: [
                                            { $eq: ["$fund_type", "OUTGOING"] },
                                            { $multiply: ["$fund_amount", -1] },
                                            "$fund_amount"
                                        ]}
                                    ]
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
                
                // Get betting transactions after end date
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
                                    $cond: {
                                        if: { $eq: ["$betting_status", "complete"] },
                                        then: {
                                            $subtract: [
                                                { $ifNull: ["$earning_amount", 0] },
                                                { $ifNull: ["$bet_amount", 0] }
                                            ]
                                        },
                                        else: { $multiply: [{ $ifNull: ["$bet_amount", 0] }, -1] }
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

    // Calculate balance_after by working backwards from adjusted current balance
    // First, reverse to get chronological order (oldest first)
    const chronological = [...allTransactions].reverse();
    
    // Group by user and calculate balance
    const userTransactions = {};
    chronological.forEach(tx => {
        const userId = tx.member.replace('user_', '');
        if (userId === '-' || !mongoose.Types.ObjectId.isValid(userId)) return;
        
        if (!userTransactions[userId]) {
            userTransactions[userId] = [];
        }
        userTransactions[userId].push(tx);
    });

    // Calculate balance_after for each user's transactions
    Object.keys(userTransactions).forEach(userId => {
        const userTxs = userTransactions[userId];
        const currentBalance = userBalances[userId] || 0;
        const afterEndAmount = transactionsAfterEnd[userId] || 0;
        
        // Start from current balance, subtract transactions after end date
        // to get balance at end of filter range
        let runningBalance = currentBalance - afterEndAmount;
        
        // Work backwards: subtract all transactions in filtered set
        userTxs.forEach(tx => {
            runningBalance -= tx.amount;
        });
        
        // Now work forward to calculate balance_after for each transaction
        userTxs.forEach(tx => {
            runningBalance += tx.amount;
            tx.balance_after = Math.round(runningBalance * 100) / 100; // Round to 2 decimal places
        });
    });

    // Reverse back to newest first
    chronological.reverse();

    // Apply pagination
    const total = chronological.length;
    const paginatedData = chronological.slice(skip, skip + limit);

    responseSuccess(res, {
        list: paginatedData,
        total,
        page: pageNumber,
        pageSize: limit
    });
};

