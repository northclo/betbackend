import BettingResultModel from "../../../models/BettingResult.js";
import GameResultModel from "../../../models/GameResult.js";
import PartnerModel from "../../../models/Partner.js";
import { responseBadRequest, responseSuccess, responseServerError } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import { getLastGame } from "../../../helper/Game/Get-Last-Game.js";
import mongoose from "mongoose";
import { t } from "../../../helper/translation.js";

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

        const user = await UserModel.findOne({ _id: userId }).lean();
        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        const partnerObjectId = user.partner_id || user.ownpartner_id;
        let partner = null;
        if (partnerObjectId) {
            partner = await PartnerModel.findOne({ _id: partnerObjectId }).lean();
        }

        if (!partner || !partner.cancel_bet) {
            return responseBadRequest(res, t("bet_cancellation_disabled"));
        }

        const secondsUntilStart = Math.floor((game.start_time_stamp - getCurrentTime()) / 1000);
        
        const cancelBetRange = partner.cancel_bet_range || {};
        const endTime = cancelBetRange.end_time;
        
        if (endTime !== undefined && endTime !== null && endTime > 0) {
            if (secondsUntilStart < endTime) {
                return responseBadRequest(res, t("cancellation_window_closed"));
            }
            if (secondsUntilStart > 180) {
                return responseBadRequest(res, t("cancellation_window_closed"));
            }
        } else {
            if (secondsUntilStart < 90 || secondsUntilStart > 180) {
                return responseBadRequest(res, t("cancellation_window_closed"));
            }
        }

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

        await UserModel.updateOne(
            { _id: userId },
            { $inc: { own_money: bettingHistory.bet_amount } },
            { session }
        );

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