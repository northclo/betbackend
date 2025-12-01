import BettingResultModel from "../../models/BettingResult.js";
import UserModel from "../../models/User.js";
import PartnerModel from "../../models/Partner.js";
import mongoose from "mongoose";

export const updateBetting = async (gameId, odd, under, list, todayNo, totalNo) => {
    const bettingHistory = await BettingResultModel.find({ game_id: gameId });
    const numberSortColumn = new Set(['number_13', 'number_14', 'number_16']);

    const userEarnings = new Map();
    const userPoints = new Map();

    const bulkOps = bettingHistory.reduce((ops, element) => {
        if (element.betting_status === "CANCEL") {
            return ops;
        }

        let win = true;

        if (numberSortColumn.has(element.betting_type)) {
            win = element.number_sort.every((val, idx) => list[idx] === val);
        } else {
            const conditions = element.betting_type.split("_");
            win = conditions.every(typeElement => {
                if (typeElement === "odd") return odd;
                if (typeElement === "even") return !odd;
                if (typeElement === "under") return under;
                if (typeElement === "over") return !under;
                return false;
            });
        }

        const earningAmount = win ? element.bet_amount * element.betting_rate : 0;

        if (earningAmount > 0 && element.user_id) {
            const userId = element.user_id.toString();
            userEarnings.set(userId, (userEarnings.get(userId) || 0) + earningAmount);
        }

        let bettingPointValue = 0;
        let partnerBetBenefit = 0;
        
        if (!win && element.betting_point_rate && element.bet_amount) {
            bettingPointValue = (element.bet_amount * element.betting_point_rate) / 100;
            
            partnerBetBenefit = element.bet_amount - bettingPointValue;
            
            if (element.user_id) {
                const userId = element.user_id.toString();
                userPoints.set(userId, (userPoints.get(userId) || 0) + bettingPointValue);
            }
        }

        const updateData = {
            today_no: todayNo,
            total_no: totalNo,
            win,
            earning_amount: earningAmount,
            betting_status: "COMPLETE"
        };

        if (!win) {
            updateData.betting_point_value = bettingPointValue;
            updateData.partner_bet_benefit = partnerBetBenefit;
        }

        ops.push({
            updateOne: {
                filter: { _id: element._id },
                update: {
                    $set: updateData,
                    $currentDate: {
                        updatedAt: true
                    }
                }
            }
        });

        return ops;
    }, []);

    if (bulkOps.length) {
        await BettingResultModel.bulkWrite(bulkOps);
    }

    if (userEarnings.size > 0) {
        const userBalanceUpdates = [];
        const partnerBalanceUpdates = [];
        const earningUserIds = Array.from(userEarnings.keys());
        
        const existingEarningUsers = await UserModel.find({ 
            _id: { $in: earningUserIds.map(id => new mongoose.Types.ObjectId(id)) } 
        }).select('_id').lean();
        
        const existingEarningUserIds = new Set(existingEarningUsers.map(u => u._id.toString()));
        
        for (const [userId, totalEarning] of userEarnings.entries()) {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            
            if (existingEarningUserIds.has(userId)) {
                userBalanceUpdates.push({
                    updateOne: {
                        filter: { _id: userObjectId },
                        update: { $inc: { own_money: totalEarning } }
                    }
                });
            } else {
                partnerBalanceUpdates.push({
                    updateOne: {
                        filter: { _id: userObjectId },
                        update: { $inc: { own_money: totalEarning } }
                    }
                });
            }
        }
        
        if (userBalanceUpdates.length > 0) {
            await UserModel.bulkWrite(userBalanceUpdates, { ordered: false });
        }
        
        if (partnerBalanceUpdates.length > 0) {
            await PartnerModel.bulkWrite(partnerBalanceUpdates, { ordered: false });
        }
    }

    if (userPoints.size > 0) {
        const userPointUpdates = [];
        const partnerPointUpdates = [];
        const userIds = Array.from(userPoints.keys());
        
        const existingUsers = await UserModel.find({ 
            _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } 
        }).select('_id').lean();
        
        const existingUserIds = new Set(existingUsers.map(u => u._id.toString()));
        
        for (const [userId, totalPoints] of userPoints.entries()) {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            
            if (existingUserIds.has(userId)) {
                userPointUpdates.push({
                    updateOne: {
                        filter: { _id: userObjectId },
                        update: { $inc: { point: totalPoints } }
                    }
                });
            } else {
                partnerPointUpdates.push({
                    updateOne: {
                        filter: { _id: userObjectId },
                        update: { $inc: { point: totalPoints } }
                    }
                });
            }
        }
        
        if (userPointUpdates.length > 0) {
            await UserModel.bulkWrite(userPointUpdates, { ordered: false });
        }
        
        if (partnerPointUpdates.length > 0) {
            await PartnerModel.bulkWrite(partnerPointUpdates, { ordered: false });
        }
    }
};
