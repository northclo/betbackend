import mongoose from "mongoose";
import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import PartnerLoginHistoryModel from "../../../models/PartnerLoginHistory.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import SupportMessageModel from "../../../models/SupportMessage.js";
import BettingResultModel from "../../../models/BettingResult.js";
import {
  responseSuccess,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";
import { userStatus } from "../../../const/status.js";

export const getMonthlyLoggedInUsers = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        const loginHistoryFilter = {
            createdAt: {
                $gte: startOfMonth,
                $lte: endOfMonth
            }
        };

        const userLoginHistory = await UserLoginHistoryModel.find(loginHistoryFilter)
            .select("user_id createdAt").lean();

        const partnerLoginHistory = await PartnerLoginHistoryModel.find(loginHistoryFilter)
            .select("partner_id createdAt").lean();

        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const allLoggedIn = new Array(daysInMonth).fill(0);
        const partnerLoggedIn = new Array(daysInMonth).fill(0);

        const dailyUsers = {};
        const dailyPartners = {};

        userLoginHistory.forEach(login => {
            const day = new Date(login.createdAt).getDate() - 1;
            const userId = login.user_id?.toString();

            if (userId) {
                if (!dailyUsers[day]) {
                    dailyUsers[day] = new Set();
                }
                if (!dailyUsers[day].has(userId)) {
                    dailyUsers[day].add(userId);
                    allLoggedIn[day]++;
                }
            }
        });

        partnerLoginHistory.forEach(login => {
            const day = new Date(login.createdAt).getDate() - 1;
            const partnerId = login.partner_id?.toString();

            if (partnerId) {
                if (!dailyPartners[day]) {
                    dailyPartners[day] = new Set();
                }
                if (!dailyPartners[day].has(partnerId)) {
                    dailyPartners[day].add(partnerId);
                    partnerLoggedIn[day]++;
                }
            }
        });

        responseSuccess(res, {
            days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
            allLoggedIn,
            partnerLoggedIn
        });
    } catch (error) {
        console.error("Error to fetch monthly logged in users:", error);
        return responseServerError(res);
    }
};

export const getMonthlyChargeAndExchange = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        const baseMatchFilter = {
            createdAt: {
                $gte: startOfMonth,
                $lte: endOfMonth
            }
        };

        const chargeData = await TransactionModel.aggregate([
            {
                $match: {
                    ...baseMatchFilter,
                    fund_type: 'IMPORT',
                    fund_status: 'APPROVED'
                }
            },
            {
                $project: {
                    day: { $dayOfMonth: "$createdAt" },
                    fund_amount: 1
                }
            },
            {
                $group: {
                    _id: "$day",
                    total: { $sum: "$fund_amount" }
                }
            }
        ]);

        const exchangeData = await TransactionModel.aggregate([
            {
                $match: {
                    ...baseMatchFilter,
                    fund_type: 'EXCHANGE',
                    fund_status: 'APPROVED'
                }
            },
            {
                $project: {
                    day: { $dayOfMonth: "$createdAt" },
                    fund_amount: 1
                }
            },
            {
                $group: {
                    _id: "$day",
                    total: { $sum: "$fund_amount" }
                }
            }
        ]);

        const charge = new Array(daysInMonth).fill(0);
        const exchange = new Array(daysInMonth).fill(0);

        chargeData.forEach(item => {
            const day = item._id - 1;
            if (day >= 0 && day < daysInMonth) {
                charge[day] = item.total;
            }
        });

        exchangeData.forEach(item => {
            const day = item._id - 1;
            if (day >= 0 && day < daysInMonth) {
                exchange[day] = item.total;
            }
        });

        responseSuccess(res, {
            days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
            charge,
            exchange
        });
    } catch (error) {
        console.error("Error to fetch monthly charge and exchange:", error);
        return responseServerError(res);
    }
};

export const getDashboardSummary = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endOfToday.setHours(23, 59, 59, 999);

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const allUsers = await UserModel.find({}).select("_id user_status").lean();
        const totalMembers = allUsers.length;
        const pendingApprovals = allUsers.filter(u => u.user_status === userStatus.wait).length;
        const allUserIds = allUsers.map(u => u._id);

        let activeMembers = 0;
        if (allUserIds.length > 0) {
            const activeMemberIds = await UserLoginHistoryModel.distinct("user_id", {
                user_id: { $in: allUserIds },
                createdAt: {
                    $gte: startOfToday,
                    $lte: endOfToday
                }
            });
            activeMembers = activeMemberIds.length;
        }

        const totalPartners = await PartnerModel.countDocuments({});

        const newPartners = await PartnerModel.countDocuments({
            createdAt: {
                $gte: sevenDaysAgo
            }
        });

        let pendingCharges = 0;
        if (allUserIds.length > 0) {
            pendingCharges = await TransactionModel.countDocuments({
                user_id: { $in: allUserIds },
                fund_type: 'IMPORT',
                fund_status: 'PENDING'
            });
        }

        let supportTickets = 0;
        if (allUserIds.length > 0) {
            supportTickets = await SupportMessageModel.countDocuments({
                userId: { $in: allUserIds },
                status: 'pending'
            });
        }

        responseSuccess(res, {
            totalMembers,
            activeMembers,
            totalPartners,
            newPartners,
            pendingApprovals,
            pendingCharges,
            supportTickets
        });
    } catch (error) {
        console.error("Error fetching dashboard summary:", error);
        return responseServerError(res);
    }
};

export const getSidebarSummary = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endOfToday.setHours(23, 59, 59, 999);

        const allCompletedBets = await BettingResultModel.aggregate([
            {
                $match: {
                    betting_status: "complete"
                }
            },
            {
                $group: {
                    _id: null,
                    totalBetAmount: { $sum: "$bet_amount" },
                    totalPayout: {
                        $sum: {
                            $cond: [
                                { $eq: ["$win", true] },
                                "$earning_amount",
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const bettingProfit = allCompletedBets.length > 0 
            ? (allCompletedBets[0].totalBetAmount - allCompletedBets[0].totalPayout)
            : 0;

        const totalPointsResult = await UserModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalPoints: { $sum: "$point" }
                }
            }
        ]);
        const totalUserPoints = totalPointsResult.length > 0 ? totalPointsResult[0].totalPoints : 0;

        const activeUserIds = await UserLoginHistoryModel.distinct("user_id", {
            createdAt: {
                $gte: startOfToday,
                $lte: endOfToday
            }
        });
        const currentSiteUsers = activeUserIds.length;

        const depositResult = await TransactionModel.aggregate([
            {
                $match: {
                    fund_type: 'IMPORT',
                    fund_status: 'APPROVED',
                    createdAt: {
                        $gte: startOfToday,
                        $lte: endOfToday
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$fund_amount" }
                }
            }
        ]);
        const todayDeposit = depositResult.length > 0 ? depositResult[0].total : 0;

        const withdrawalResult = await TransactionModel.aggregate([
            {
                $match: {
                    fund_type: 'EXCHANGE',
                    fund_status: 'APPROVED',
                    createdAt: {
                        $gte: startOfToday,
                        $lte: endOfToday
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$fund_amount" }
                }
            }
        ]);
        const todayWithdrawal = withdrawalResult.length > 0 ? withdrawalResult[0].total : 0;

        const entireGameStats = await BettingResultModel.aggregate([
            {
                $match: {
                    betting_status: { $in: ["wait", "progress", "complete"] },
                    betting_type: { $nin: ["number_13", "number_14", "number_16"] }
                }
            },
            {
                $group: {
                    _id: null,
                    battingGan: { $sum: 1 }, 
                    betting: {
                        $sum: {
                            $cond: [{ $eq: ["$betting_status", "complete"] }, 1, 0]
                        }
                    }, 
                    hit: {
                        $sum: {
                            $cond: [{ $and: ["$win", { $eq: ["$betting_status", "complete"] }] }, 1, 0]
                        }
                    },
                    bettingP: { $sum: "$bet_amount" }, 
                    revenue: {
                        $sum: {
                            $cond: [
                                { $and: ["$win", { $eq: ["$betting_status", "complete"] }] },
                                { $subtract: ["$earning_amount", "$bet_amount"] },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const entireGame = entireGameStats.length > 0 ? {
            battingGan: entireGameStats[0].battingGan || 0,
            betting: entireGameStats[0].betting || 0,
            hit: entireGameStats[0].hit || 0,
            bettingP: entireGameStats[0].bettingP || 0,
            revenue: entireGameStats[0].revenue || 0
        } : {
            battingGan: 0,
            betting: 0,
            hit: 0,
            bettingP: 0,
            revenue: 0
        };

        const minigameStats = await BettingResultModel.aggregate([
            {
                $match: {
                    betting_status: { $in: ["wait", "progress", "complete"] },
                    betting_type: { $in: ["number_13", "number_14", "number_16"] }
                }
            },
            {
                $group: {
                    _id: null,
                    battingGan: { $sum: 1 },
                    hit: {
                        $sum: {
                            $cond: [{ $and: ["$win", { $eq: ["$betting_status", "complete"] }] }, 1, 0]
                        }
                    },
                    bettingP: { $sum: "$bet_amount" },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $and: ["$win", { $eq: ["$betting_status", "complete"] }] },
                                { $subtract: ["$earning_amount", "$bet_amount"] },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const minigames = minigameStats.length > 0 ? {
            battingGan: minigameStats[0].battingGan || 0,
            hit: minigameStats[0].hit || 0,
            bettingP: minigameStats[0].bettingP || 0,
            revenue: minigameStats[0].revenue || 0
        } : {
            battingGan: 0,
            hit: 0,
            bettingP: 0,
            revenue: 0
        };

        responseSuccess(res, {
            bettingSettlementProfit: bettingProfit,
            userPoints: totalUserPoints,
            currentSiteUsers: currentSiteUsers,
            todayDeposit: todayDeposit,
            todayWithdrawal: todayWithdrawal,
            entireGame,
            minigames
        });
    } catch (error) {
        console.error("Error fetching sidebar summary:", error);
        return responseServerError(res);
    }
};

