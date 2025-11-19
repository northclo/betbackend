import mongoose from "mongoose";
import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import SupportMessageModel from "../../../models/SupportMessage.js";
import BettingResultModel from "../../../models/BettingResult.js";
import { responseSuccess } from "../../../helper/response.js";
import { userStatus } from "../../../const/status.js";


const fetchAccessiblePartners = async (partnerId) => {
    if (!partnerId) return { partnerIds: [], partners: [] };

    const roots = await PartnerModel.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(partnerId)
            },
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
                nickname: { $ifNull: ["$nickname", ""] },
                partner_id: { $ifNull: ["$partner_id", ""] },
            },
        },
    ]);

    if (!roots.length) {
        return { partnerIds: [], partners: [] };
    }

    const uniqueMap = new Map();
    roots.forEach((doc) => {
        const key = doc._id.toString();
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, {
                id: key,
                nickname: doc.nickname || "",
                partnerId: doc.partner_id || "",
            });
        }
    });

    const partners = Array.from(uniqueMap.values());
    const partnerIds = partners.map((partner) => new mongoose.Types.ObjectId(partner.id));

    return { partnerIds, partners };
};

export const getMonthlyLoggedInUsers = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        const { partnerIds: accessiblePartnerIds } = await fetchAccessiblePartners(req.session?._id);

        let accessibleUserIds = [];
        let accessiblePartnerUserIds = [];
        if (accessiblePartnerIds.length > 0) {
            const users = await UserModel.find({
                partner_id: { $in: accessiblePartnerIds }
            }).select("_id").lean();
            accessibleUserIds = users.map(u => u._id);
            accessiblePartnerUserIds = accessibleUserIds;
        }

        const loginHistoryFilter = {
            createdAt: {
                $gte: startOfMonth,
                $lte: endOfMonth
            }
        };

        if (accessiblePartnerIds.length > 0 && accessibleUserIds.length > 0) {
            loginHistoryFilter.user_id = { $in: accessibleUserIds };
        } else {
            loginHistoryFilter.user_id = { $exists: false };
        }

        const loginHistory = await UserLoginHistoryModel.find(loginHistoryFilter)
            .select("user_id createdAt").lean();

        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const allLoggedIn = new Array(daysInMonth).fill(0);
        const partnerLoggedIn = new Array(daysInMonth).fill(0);

        const dailyUsers = {};
        const dailyPartnerUsers = {};

        loginHistory.forEach(login => {
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

                const isPartnerUser = accessiblePartnerUserIds.some(pid => pid.toString() === userId);
                if (isPartnerUser) {
                    if (!dailyPartnerUsers[day]) {
                        dailyPartnerUsers[day] = new Set();
                    }
                    if (!dailyPartnerUsers[day].has(userId)) {
                        dailyPartnerUsers[day].add(userId);
                        partnerLoggedIn[day]++;
                    }
                }
            }
        });

        responseSuccess(res, {
            days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
            allLoggedIn,
            partnerLoggedIn
        });
    } catch (error) {
        console.error("Error fetching monthly logged in users:", error);
        responseSuccess(res, {
            days: Array.from({ length: 30 }, (_, i) => i + 1),
            allLoggedIn: new Array(30).fill(0),
            partnerLoggedIn: new Array(30).fill(0)
        });
    }
};

export const getMonthlyChargeAndExchange = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        const { partnerIds: accessiblePartnerIds } = await fetchAccessiblePartners(req.session?._id);

        let accessibleUserIds = [];
        if (accessiblePartnerIds.length > 0) {
            const users = await UserModel.find({
                partner_id: { $in: accessiblePartnerIds }
            }).select("_id").lean();
            accessibleUserIds = users.map(u => u._id);
        }

        const baseMatchFilter = {
            createdAt: {
                $gte: startOfMonth,
                $lte: endOfMonth
            }
        };

        if (accessiblePartnerIds.length > 0 && accessibleUserIds.length > 0) {
            baseMatchFilter.user_id = { $in: accessibleUserIds };
        } else {
            baseMatchFilter.user_id = { $exists: false };
        }

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
        const chargeMinusExchange = new Array(daysInMonth).fill(0);

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

        for (let i = 0; i < daysInMonth; i++) {
            chargeMinusExchange[i] = charge[i] - exchange[i];
        }

        responseSuccess(res, {
            days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
            charge,
            withdraw: exchange,
            chargeMinusWithdraw: chargeMinusExchange
        });
    } catch (error) {
        console.error("Error fetching monthly charge and exchange:", error);
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        responseSuccess(res, {
            days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
            charge: new Array(daysInMonth).fill(0),
            withdraw: new Array(daysInMonth).fill(0),
            chargeMinusWithdraw: new Array(daysInMonth).fill(0)
        });
    }
};

export const getDashboardSummary = async (req, res) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endOfToday.setHours(23, 59, 59, 999);

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const { partnerIds: accessiblePartnerIds } = await fetchAccessiblePartners(req.session?._id);

        let accessibleUserIds = [];
        let totalMembers = 0;
        let pendingApprovals = 0;

        if (accessiblePartnerIds.length > 0) {
            const users = await UserModel.find({
                partner_id: { $in: accessiblePartnerIds }
            }).select("_id user_status").lean();
            accessibleUserIds = users.map(u => u._id);
            totalMembers = users.length;
            pendingApprovals = users.filter(u => u.user_status === userStatus.wait).length;
        }

        let activeMembers = 0;
        if (accessibleUserIds.length > 0) {
            const activeMemberIds = await UserLoginHistoryModel.distinct("user_id", {
                user_id: { $in: accessibleUserIds },
                createdAt: {
                    $gte: startOfToday,
                    $lte: endOfToday
                }
            });
            activeMembers = activeMemberIds.length;
        }

        const totalPartners = accessiblePartnerIds.length;

        let newPartners = 0;
        if (accessiblePartnerIds.length > 0) {
            newPartners = await PartnerModel.countDocuments({
                _id: { $in: accessiblePartnerIds },
                createdAt: {
                    $gte: sevenDaysAgo
                }
            });
        }

        let pendingCharges = 0;
        if (accessibleUserIds.length > 0) {
            pendingCharges = await TransactionModel.countDocuments({
                user_id: { $in: accessibleUserIds },
                fund_type: 'IMPORT',
                fund_status: 'PENDING'
            });
        }

        let supportTickets = 0;
        if (accessibleUserIds.length > 0) {
            supportTickets = await SupportMessageModel.countDocuments({
                userId: { $in: accessibleUserIds },
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
        responseSuccess(res, {
            totalMembers: 0,
            activeMembers: 0,
            totalPartners: 0,
            newPartners: 0,
            pendingApprovals: 0,
            pendingCharges: 0,
            supportTickets: 0
        });
    }
};

export const getSidebarSummary = async (req, res) => {
    try {
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
        responseSuccess(res, {
            bettingSettlementProfit: 0,
            userPoints: 0,
            currentSiteUsers: 0,
            todayDeposit: 0,
            todayWithdrawal: 0,
            entireGame: {
                battingGan: 0,
                betting: 0,
                hit: 0,
                bettingP: 0,
                revenue: 0
            },
            minigames: {
                battingGan: 0,
                hit: 0,
                bettingP: 0,
                revenue: 0
            }
        });
    }
};

