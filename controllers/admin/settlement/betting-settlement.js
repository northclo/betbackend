import { responseSuccess, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import BettingResultModel from "../../../models/BettingResult.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import moment from "moment-timezone";
import { config } from "../../../config/index.js";
import { fetchAccessiblePartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

const normalizeDate = (value, isEnd = false) => {
    if (!value) return null;
    
    let dateMoment = moment.tz(value, "YYYY-MM-DD", config.TIME_ZONE);
    
    if (!dateMoment.isValid()) {
        dateMoment = moment.tz(value, config.TIME_ZONE);
    }
    
    if (!dateMoment.isValid()) {
        return null;
    }
    
    if (isEnd) {
        dateMoment = dateMoment.endOf('day');
    } else {
        dateMoment = dateMoment.startOf('day');
    }
    
    return dateMoment.toDate();
};


export const getBettingSettlementProfit = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        let {
            startDate,
            endDate,
            partnerId,
            includeSubPartners,
            page = 1,
            pageSize = 20
        } = req.query;

        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate, true);

        const pageNumber = Math.max(Math.min(parseInt(page, 10) || 1, 1000), 1);
        const limit = Math.max(Math.min(parseInt(pageSize, 10) || 20, 100), 1);
        const skip = (pageNumber - 1) * limit;

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);

        let partnerIds = [];
        let userPartnerIds = [];
        
        if (partnerId) {
            const includeSubs = includeSubPartners === 'true' || includeSubPartners === true;
            
            const requestedPartner = await PartnerModel.findOne({ partner_id: partnerId }).select("_id").lean();
            if (!requestedPartner) {
                partnerIds = [];
            } else {
                const isAccessible = accessiblePartnerIds.some(id => id.toString() === requestedPartner._id.toString());
                
                if (isAccessible) {
                    if (includeSubs) {
                        const subPartnerIds = await fetchAccessiblePartnerIds(requestedPartner._id);
                        partnerIds = subPartnerIds;
                    } else {
                        partnerIds = [requestedPartner._id];
                    }
                } else {
                    partnerIds = [];
                }
            }
        } else {
            partnerIds = accessiblePartnerIds;
        }

        if (partnerIds.length > 0) {
            const users = await UserModel.find({
                $or: [
                    { partner_id: { $in: partnerIds } },
                    { ownpartner_id: { $in: partnerIds } }
                ]
            }).select('_id').lean();
            userPartnerIds = users.map(u => u._id);
        }

        const dateFilter = {};
        if (start || end) {
            dateFilter.createdAt = {};
            if (start) dateFilter.createdAt.$gte = start;
            if (end) dateFilter.createdAt.$lte = end;
        }

        const allTransactionUserIds = [];
        if (userPartnerIds.length > 0) {
            allTransactionUserIds.push(...userPartnerIds);
        }
        if (partnerIds.length > 0) {
            allTransactionUserIds.push(...partnerIds);
        }

        if (allTransactionUserIds.length === 0) {
            return responseSuccess(res, {
                settlements: {
                    items: [],
                    total: 0,
                    page: pageNumber,
                    pageSize: limit
                }
            });
        }

        const transactionMatch = {
            ...dateFilter,
            fund_status: 'COMPLETE',
            user_id: { $in: allTransactionUserIds }
        };

        const transactionAggregates = await TransactionModel.aggregate([
            { $match: transactionMatch },
            {
                $lookup: {
                    from: "partners",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "userAsPartner"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "userAsUser"
                }
            },
            {
                $addFields: {
                    isUser: { $gt: [{ $size: "$userAsUser" }, 0] },
                    isPartner: { $gt: [{ $size: "$userAsPartner" }, 0] }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: config.TIME_ZONE } },
                        fund_type: "$fund_type"
                    },
                    charge_total_amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "CHARGE"] },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    charge_total_count: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "CHARGE"] },
                                1,
                                0
                            ]
                        }
                    },
                    charge_amount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$fund_type", "CHARGE"] },
                                        "$isUser"
                                    ]
                                },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    charge_count: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$fund_type", "CHARGE"] },
                                        "$isUser"
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    partner_increase: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "PARTNER_INCREASE"] },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    exchange_total_amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "EXCHANGE"] },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    exchange_total_count: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "EXCHANGE"] },
                                1,
                                0
                            ]
                        }
                    },
                    withdraw: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$fund_type", "EXCHANGE"] },
                                        "$isUser"
                                    ]
                                },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    withdraw_count: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$fund_type", "EXCHANGE"] },
                                        "$isUser"
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    partner_decrease: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "PARTNER_DECREASE"] },
                                "$fund_amount",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$_id.date",
                    chargeTotalAmount: { $sum: "$charge_total_amount" },
                    chargeTotalAmount_count: { $sum: "$charge_total_count" },
                    chargeAmount: { $sum: "$charge_amount" },
                    chargeAmount_count: { $sum: "$charge_count" },
                    partnerIncrease: { $sum: "$partner_increase" },
                    exchangeTotalAmount: { $sum: "$exchange_total_amount" },
                    exchangeTotalAmount_count: { $sum: "$exchange_total_count" },
                    withdraw: { $sum: "$withdraw" },
                    withdraw_count: { $sum: "$withdraw_count" },
                    partnerDecrease: { $sum: "$partner_decrease" }
                }
            }
        ]);

        const bettingDateFilter = {};
        if (start || end) {
            bettingDateFilter.updatedAt = {};
            if (start) bettingDateFilter.updatedAt.$gte = start;
            if (end) bettingDateFilter.updatedAt.$lte = end;
        }

        const bettingMatch = {
            betting_status: 'COMPLETE',
            ...bettingDateFilter
        };

        const allBettingUserIds = [];
        if (userPartnerIds.length > 0) {
            allBettingUserIds.push(...userPartnerIds);
        }
        if (partnerIds.length > 0) {
            allBettingUserIds.push(...partnerIds);
        }

        if (allBettingUserIds.length > 0) {
            bettingMatch.user_id = { $in: allBettingUserIds };
        }

        const bettingAggregates = await BettingResultModel.aggregate([
            { $match: bettingMatch },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt", timezone: config.TIME_ZONE } }
                    },
                    total_betting_amount: { $sum: "$bet_amount" },
                    win_betting_amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$win", true] },
                                "$bet_amount",
                                0
                            ]
                        }
                    },
                    losing_amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$win", false] },
                                "$bet_amount",
                                0
                            ]
                        }
                    },
                    bet_increase: {
                        $sum: {
                            $cond: [
                                { $eq: ["$win", true] },
                                "$earning_amount",
                                0
                            ]
                        }
                    },
                    bet_decrease: {
                        $sum: {
                            $cond: [
                                { $eq: ["$win", false] },
                                "$bet_amount",
                                0
                            ]
                        }
                    },
                    betting_p: { $sum: "$bet_amount" },
                    win_count: {
                        $sum: {
                            $cond: [{ $eq: ["$win", true] }, 1, 0]
                        }
                    },
                    lose_count: {
                        $sum: {
                            $cond: [{ $eq: ["$win", false] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const transactionMap = new Map();
        transactionAggregates.forEach(item => {
            transactionMap.set(item._id, item);
        });

        const bettingMap = new Map();
        bettingAggregates.forEach(item => {
            bettingMap.set(item._id.date, item);
        });

        const allDates = new Set();
        transactionMap.forEach((value, key) => allDates.add(key));
        bettingMap.forEach((value, key) => allDates.add(key));

        const dailyData = Array.from(allDates).map(date => {
            const transaction = transactionMap.get(date) || {};
            const betting = bettingMap.get(date) || {};

            const totalBettingAmount = betting.total_betting_amount || 0;
            const winBettingAmount = betting.win_betting_amount || 0;
            const losingAmount = betting.losing_amount || 0;
            const betIncrease = betting.bet_increase || 0;
            const betDecrease = betting.bet_decrease || 0;
            const bettingProfit = totalBettingAmount - betIncrease;
            const bettingP = 0;
            
            const partnerRate = 3.5;
            
            const companyProfit = totalBettingAmount - betIncrease - (totalBettingAmount * partnerRate / 100);
            
            const chargeTotalAmount = transaction.chargeTotalAmount || 0;
            const chargeAmount = transaction.chargeAmount || 0;
            const partnerIncrease = transaction.partnerIncrease || 0;
            
            const exchangeTotalAmount = transaction.exchangeTotalAmount || 0;
            const withdraw = transaction.withdraw || 0;
            const partnerDecrease = transaction.partnerDecrease || 0;

            return {
                date: date,
                totalBettingAmount: totalBettingAmount,
                totalBettingAmount_count: (betting.win_count || 0) + (betting.lose_count || 0),
                winBettingAmount: winBettingAmount,
                losingAmount: losingAmount,
                losingAmount_count: betting.lose_count || 0,
                bettingProfit: bettingProfit,
                bettingP: bettingP,
                partnerRate: partnerRate,
                companyProfit: companyProfit,
                chargeTotalAmount: chargeTotalAmount,
                chargeTotalAmount_count: transaction.chargeTotalAmount_count || 0,
                chargeAmount: chargeAmount,
                chargeAmount_count: transaction.chargeAmount_count || 0,
                partnerIncrease: partnerIncrease,
                exchangeTotalAmount: exchangeTotalAmount,
                exchangeTotalAmount_count: transaction.exchangeTotalAmount_count || 0,
                withdraw: withdraw,
                withdraw_count: transaction.withdraw_count || 0,
                partnerDecrease: partnerDecrease
            };
        });

        dailyData.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA;
        });

        const sumRow = dailyData.reduce((sum, item) => {
            return {
                totalBettingAmount: sum.totalBettingAmount + (item.totalBettingAmount || 0),
                winBettingAmount: sum.winBettingAmount + (item.winBettingAmount || 0),
                losingAmount: sum.losingAmount + (item.losingAmount || 0),
                bettingProfit: sum.bettingProfit + (item.bettingProfit || 0),
                bettingP: sum.bettingP + (item.bettingP || 0),
                companyProfit: sum.companyProfit + (item.companyProfit || 0),
                chargeTotalAmount: sum.chargeTotalAmount + (item.chargeTotalAmount || 0),
                chargeTotalAmount_count: sum.chargeTotalAmount_count + (item.chargeTotalAmount_count || 0),
                chargeAmount: sum.chargeAmount + (item.chargeAmount || 0),
                chargeAmount_count: sum.chargeAmount_count + (item.chargeAmount_count || 0),
                partnerIncrease: sum.partnerIncrease + (item.partnerIncrease || 0),
                exchangeTotalAmount: sum.exchangeTotalAmount + (item.exchangeTotalAmount || 0),
                exchangeTotalAmount_count: sum.exchangeTotalAmount_count + (item.exchangeTotalAmount_count || 0),
                withdraw: sum.withdraw + (item.withdraw || 0),
                withdraw_count: sum.withdraw_count + (item.withdraw_count || 0),
                partnerDecrease: sum.partnerDecrease + (item.partnerDecrease || 0),
                totalBettingAmount_count: sum.totalBettingAmount_count + (item.totalBettingAmount_count || 0),
                losingAmount_count: sum.losingAmount_count + (item.losingAmount_count || 0)
            };
        }, {
            totalBettingAmount: 0,
            winBettingAmount: 0,
            losingAmount: 0,
            losingAmount_count: 0,
            bettingProfit: 0,
            bettingP: 0,
            companyProfit: 0,
            chargeTotalAmount: 0,
            chargeTotalAmount_count: 0,
            chargeAmount: 0,
            chargeAmount_count: 0,
            partnerIncrease: 0,
            exchangeTotalAmount: 0,
            exchangeTotalAmount_count: 0,
            withdraw: 0,
            withdraw_count: 0,
            partnerDecrease: 0,
            totalBettingAmount_count: 0
        });

        const avgPartnerRate = dailyData.length > 0 
            ? dailyData.reduce((sum, item) => sum + (item.partnerRate || 0), 0) / dailyData.length 
            : 0;

        const sumRowWithDate = {
            ...sumRow,
            date: null,
            partnerRate: avgPartnerRate,
            isSum: true
        };

        const total = dailyData.length;
        const paginatedData = dailyData.slice(skip, skip + limit);
        const resultData = [sumRowWithDate, ...paginatedData];

        return responseSuccess(res, {
            settlements: {
                items: resultData,
                total: total,
                page: pageNumber,
                pageSize: limit
            }
        });

    } catch (error) {
        console.error("Error fetching betting settlement profit:", error);
        return responseServerError(res);
    }
};
