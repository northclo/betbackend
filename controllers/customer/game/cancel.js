import BettingResultModel from "../../../models/BettingResult.js";
import GameResultModel from "../../../models/GameResult.js";
import PartnerModel from "../../../models/Partner.js";
import { responseBadRequest, responseSuccess, responseServerError } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import { getLastGame } from "../../../helper/Game/Get-Last-Game.js";
import mongoose from "mongoose";
import { t } from "../../../helper/translation.js";
import TransactionModel from "../../../models/TransactionHistory.js";

export const cancelGame = async (req, res) => {
    try {
        const { id } = req.body;
        const userId = req.session._id;

        if (!id) {
            return responseBadRequest(res, t("invalid_bet_id"));
        }

        const bettingHistory = await BettingResultModel.findOne({ _id: id, user_id: userId });
        if (!bettingHistory) {
            return responseBadRequest(res, t("bet_not_found"));
        }

        if (bettingHistory.betting_status !== "WAIT") {
            return responseBadRequest(res, t("bet_cannot_cancelled"));
        }

        const game = await GameResultModel.findOne({ game_id: bettingHistory.game_id });
        if (!game || !game.start_time_stamp) {
            return responseBadRequest(res, t("game_not_available_cancellation"));
        }

        let user = await UserModel.findOne({ _id: userId }).lean();
        let partnerObjectId = null;
        if (!user) {
            user = await PartnerModel.findById(userId).lean();
            if (!user) {
                return responseBadRequest(res, t("user_not_found"));
            }
            partnerObjectId = user._id;
        } else {
            partnerObjectId = user.partner_id || user.ownpartner_id;
        }

        let partner = null;
        if (partnerObjectId) {
            partner = await PartnerModel.findOne({ _id: partnerObjectId }).lean();
        }

        if (!partner || !partner.cancel_bet) {
            return responseBadRequest(res, t("bet_cancellation_disabled"));
        }

        const cancelBetRange = partner.cancel_bet_range || {};
        
        if (cancelBetRange.max_time && cancelBetRange.max_time > 0) {
            const roundCancellations = await BettingResultModel.countDocuments({
                user_id: userId,
                game_id: bettingHistory.game_id,
                betting_status: "CANCEL"
            });

            if (roundCancellations >= cancelBetRange.max_time) {
                return responseBadRequest(res, t("cancellation_limit_per_round_reached"));
            }
        }

        if (cancelBetRange.perday_time && cancelBetRange.perday_time > 0) {
            const currentTime = getCurrentTime();
            const startOfDay = new Date(currentTime);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(currentTime);
            endOfDay.setHours(23, 59, 59, 999);

            const dailyCancellations = await BettingResultModel.countDocuments({
                user_id: userId,
                betting_status: "CANCEL",
                createdAt: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            });

            if (dailyCancellations >= cancelBetRange.perday_time) {
                return responseBadRequest(res, t("cancellation_limit_per_day_reached"));
            }
        }

        const lastGame = await getLastGame();
        const lastTodayNo = Number.isFinite(lastGame?.today_no) ? lastGame.today_no : 0;
        const lastTotalNo = Number.isFinite(lastGame?.total_no) ? lastGame.total_no : 0;

        const hasResult = Array.isArray(game.list) && game.list.length > 0;
        const todayNo = hasResult ? (game.today_no ?? lastTodayNo) : lastTodayNo + 1;
        const totalNo = hasResult ? (game.total_no ?? lastTotalNo) : lastTotalNo + 1;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
        const result = await BettingResultModel.updateOne(
            { _id: id, user_id: userId, betting_status: "WAIT" },
            {
                $set: {
                    betting_status: "CANCEL",
                    history_view: true,
                    total_no: totalNo,
                    today_no: todayNo,
                },
            },
            { session }
        );

        if (!result.modifiedCount) {
            await session.abortTransaction();
            return responseBadRequest(res, t("bet_cancellation_failed"));
        }

        const existingTransaction = await TransactionModel.findOne({
            user_id: userId,
            fund_type: "BETTING",
            fund_status: "WAIT",
            fund_amount: -bettingHistory.bet_amount,
            comment: { $regex: `Bet ID: ${id}` }
        }).session(session);

        if (existingTransaction) {
            await TransactionModel.updateOne(
                { _id: existingTransaction._id },
                {
                    $set: {
                        fund_status: "CANCEL",
                        fund_status_update_date: new Date()
                    }
                },
                { session }
            );
        } else {
            await TransactionModel.create([{
                user_id: userId,
                fund_type: "BETTING",
                fund_status: "CANCEL",
                fund_amount: bettingHistory.bet_amount,
                request_send_date: new Date(),
                fund_status_update_date: new Date(),
                comment: `Bet ID: ${id} - Cancelled`
            }], { session });
        }

        const updateUser = await UserModel.updateOne(
            { _id: userId },
            { $inc: { own_money: bettingHistory.bet_amount } },
            { session }
        );

        if (!updateUser.modifiedCount) {
            await PartnerModel.updateOne(
                { _id: userId },
                { $inc: { own_money: bettingHistory.bet_amount } },
                { session }
            );
        }

        await session.commitTransaction();

            return responseSuccess(res, { bettingAmount: bettingHistory.bet_amount });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error("Error cancelling game:", error);
        return responseServerError(res);
    }
};