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

export const getMoneyUsageSummary = async (req, res) => {
    let {
        startDate,
        endDate,
        type,
        member
    } = req.query;

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate, true);

    let dateFilter = {};
    if (start || end) {
        dateFilter.createdAt = {};
        if (start) dateFilter.createdAt.$gte = start;
        if (end) dateFilter.createdAt.$lte = end;
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
            return responseSuccess(res, {
                total_transactions: 0,
                total_inflow: 0,
                total_outflow: 0,
                net_change: 0
            });
        }
    }

    const transactionFilter = {
        ...dateFilter,
        ...transactionTypeFilter,
        ...memberFilter,
        fund_type: { $in: ['IMPORT', 'EXCHANGE', 'OUTGOING'] }
    };

    const bettingFilter = {
        ...dateFilter,
        ...bettingMemberFilter,
        ...bettingTypeFilter
    };

    const transactionStats = await TransactionModel.aggregate([
        {
            $match: transactionFilter
        },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                inflow: {
                    $sum: {
                        $cond: [
                            { $eq: ["$fund_type", "IMPORT"] },
                            "$fund_amount",
                            0
                        ]
                    }
                },
                exchange_inflow: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$fund_type", "EXCHANGE"] },
                                    { $gt: ["$fund_amount", 0] }
                                ]
                            },
                            "$fund_amount",
                            0
                        ]
                    }
                },
                exchange_outflow: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$fund_type", "EXCHANGE"] },
                                    { $lt: ["$fund_amount", 0] }
                                ]
                            },
                            { $abs: "$fund_amount" },
                            0
                        ]
                    }
                },
                outflow: {
                    $sum: {
                        $cond: [
                            { $eq: ["$fund_type", "OUTGOING"] },
                            "$fund_amount",
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const bettingStats = await BettingResultModel.aggregate([
        {
            $match: bettingFilter
        },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                bet_outflow: {
                    $sum: {
                        $cond: [
                            { $ne: ["$betting_status", "cancel"] },
                            { $ifNull: ["$bet_amount", 0] },
                            0
                        ]
                    }
                },
                bet_inflow: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$betting_status", "complete"] },
                                    { $eq: ["$win", true] }
                                ]
                            },
                            { $ifNull: ["$earning_amount", 0] },
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const txStats = transactionStats[0] || {
        count: 0,
        inflow: 0,
        exchange_inflow: 0,
        exchange_outflow: 0,
        outflow: 0
    };

    const betStats = bettingStats[0] || {
        count: 0,
        bet_outflow: 0,
        bet_inflow: 0
    };

    const total_transactions = txStats.count + betStats.count;
    const total_inflow = txStats.inflow + txStats.exchange_inflow + betStats.bet_inflow;
    const total_outflow = txStats.outflow + txStats.exchange_outflow + betStats.bet_outflow;
    const net_change = total_inflow - total_outflow;

    responseSuccess(res, {
        total_transactions,
        total_inflow,
        total_outflow,
        net_change
    });
};

