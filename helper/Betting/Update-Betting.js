import BettingResultModel from "../../models/BettingResult.js";
import UserModel from "../../models/User.js";
import mongoose from "mongoose";

export const updateBetting = async (gameId, odd, under, list, todayNo, totalNo) => {
    const bettingHistory = await BettingResultModel.find({ game_id: gameId });
    const numberSortColumn = new Set(['number_13', 'number_14', 'number_16']);

    const userEarnings = new Map();

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

        ops.push({
            updateOne: {
                filter: { _id: element._id },
                update: {
                    $set: {
                        today_no: todayNo,
                        total_no: totalNo,
                        win,
                        earning_amount: earningAmount,
                        betting_status: "COMPLETE"
                    },
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
        const balanceUpdates = Array.from(userEarnings.entries()).map(([userId, totalEarning]) => ({
            updateOne: {
                filter: { _id: new mongoose.Types.ObjectId(userId) },
                update: { $inc: { own_money: totalEarning } }
            }
        }));

        await UserModel.bulkWrite(balanceUpdates);
    }
};
