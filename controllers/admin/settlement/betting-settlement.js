import { responseSuccess, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import BettingResultModel from "../../../models/BettingResult.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import mongoose from "mongoose";
import moment from "moment-timezone";
import { config } from "../../../config/index.js";

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

const fetchAccessiblePartners = async (partnerId, includeSubs = false) => {
    if (!partnerId) return { partnerIds: [] };

    try {
        const partner = await PartnerModel.findOne({ partner_id: partnerId }).select("_id").lean();
        if (!partner) {
            return { partnerIds: [] };
        }
        
        const partnerObjectId = partner._id;
        
        if (includeSubs) {
            const roots = await PartnerModel.aggregate([
                {
                    $match: {
                        _id: partnerObjectId
                    }
                },
                {
                    $graphLookup: {
                        from: "partners",
                        startWith: "$_id",
                        connectFromField: "_id",
                        connectToField: "parent_partner_id",
                        as: "subs",
                    },
                },
                {
                    $project: {
                        allPartners: { $concatArrays: [["$$ROOT"], "$subs"] },
                    },
                },
                { $unwind: "$allPartners" },
                {
                    $replaceRoot: { newRoot: "$allPartners" },
                },
                {
                    $project: {
                        _id: 1,
                    },
                },
            ]);

            if (!roots.length) {
                return { partnerIds: [] };
            }

            const partnerIds = roots.map((doc) => doc._id);
            return { partnerIds };
        } else {
            return { partnerIds: [partnerObjectId] };
        }
    } catch (error) {
        console.error("Error fetching accessible partners:", error);
        return { partnerIds: [] };
    }
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

        let partnerIds = [];
        let userPartnerIds = [];
        
        if (partnerId) {
            const includeSubs = includeSubPartners === 'true' || includeSubPartners === true;
            const result = await fetchAccessiblePartners(partnerId, includeSubs);
            partnerIds = result.partnerIds;

            if (partnerIds.length > 0) {
                const users = await UserModel.find({
                    partner_id: { $in: partnerIds }
                }).select('_id').lean();
                userPartnerIds = users.map(u => u._id);
            }
        }

        const dateFilter = {};
        if (start || end) {
            dateFilter.createdAt = {};
            if (start) dateFilter.createdAt.$gte = start;
            if (end) dateFilter.createdAt.$lte = end;
        }

        const userFilter = partnerIds.length > 0 ? { _id: { $in: userPartnerIds } } : {};

        const transactionMatch = {
            ...dateFilter,
            fund_status: 'COMPLETE'
        };

        if (userPartnerIds.length > 0) {
            transactionMatch.user_id = { $in: userPartnerIds };
        }

        const transactionAggregates = await TransactionModel.aggregate([
            { $match: transactionMatch },
            {
                $lookup: {
                    from: "partners",
                    localField: "action_user_id",
                    foreignField: "_id",
                    as: "actionPartner"
                }
            },
            {
                $addFields: {
                    isPartnerAction: {
                        $cond: [
                            { $gt: [{ $size: "$actionPartner" }, 0] },
                            true,
                            false
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: config.TIME_ZONE } },
                        fund_type: "$fund_type"
                    },
                    total_amount: { $sum: "$fund_amount" },
                    count: { $sum: 1 },
                    charge_amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "CHARGE"] },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    exchange_amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "EXCHANGE"] },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    partner_charge: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$fund_type", "CHARGE"] },
                                        "$isPartnerAction"
                                    ]
                                },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    partner_exchange: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$fund_type", "EXCHANGE"] },
                                        "$isPartnerAction"
                                    ]
                                },
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
                    charge_total: { $sum: "$charge_amount" },
                    charge_count: {
                        $sum: {
                            $cond: [
                                { $eq: ["$_id.fund_type", "CHARGE"] },
                                "$count",
                                0
                            ]
                        }
                    },
                    exchange_total: { $sum: "$exchange_amount" },
                    exchange_count: {
                        $sum: {
                            $cond: [
                                { $eq: ["$_id.fund_type", "EXCHANGE"] },
                                "$count",
                                0
                            ]
                        }
                    },
                    partner_increase: { $sum: "$partner_charge" },
                    partner_decrease: { $sum: "$partner_exchange" }
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

        if (userPartnerIds.length > 0) {
            bettingMatch.user_id = { $in: userPartnerIds };
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
            const bettingP = betting.betting_p || 0;
            
            const partnerRate = 3.5;
            
            const companyProfit = totalBettingAmount - betIncrease - (totalBettingAmount * partnerRate / 100);
            
            const chargeTotalAmount = transaction.charge_total || 0;
            const chargeAmount = transaction.charge_total || 0;
            const partnerIncrease = transaction.partner_increase || 0;
            
            const exchangeTotalAmount = transaction.exchange_total || 0;
            const withdraw = transaction.exchange_total || 0;
            const partnerDecrease = transaction.partner_decrease || 0;

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
                chargeAmount: chargeAmount,
                chargeAmount_count: transaction.charge_count || 0,
                partnerIncrease: partnerIncrease,
                exchangeTotalAmount: exchangeTotalAmount,
                withdraw: withdraw,
                withdraw_count: transaction.exchange_count || 0,
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
                chargeAmount: sum.chargeAmount + (item.chargeAmount || 0),
                partnerIncrease: sum.partnerIncrease + (item.partnerIncrease || 0),
                exchangeTotalAmount: sum.exchangeTotalAmount + (item.exchangeTotalAmount || 0),
                withdraw: sum.withdraw + (item.withdraw || 0),
                partnerDecrease: sum.partnerDecrease + (item.partnerDecrease || 0),
                totalBettingAmount_count: sum.totalBettingAmount_count + (item.totalBettingAmount_count || 0),
                losingAmount_count: sum.losingAmount_count + (item.losingAmount_count || 0),
                chargeAmount_count: sum.chargeAmount_count + (item.chargeAmount_count || 0),
                withdraw_count: sum.withdraw_count + (item.withdraw_count || 0)
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
            chargeAmount: 0,
            partnerIncrease: 0,
            exchangeTotalAmount: 0,
            withdraw: 0,
            partnerDecrease: 0,
            totalBettingAmount_count: 0,
            losingAmount_count: 0,
            chargeAmount_count: 0,
            withdraw_count: 0
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
