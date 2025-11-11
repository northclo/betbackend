import BettingResultModel from "../../../models/BettingResult.js";
import GameResultModel from "../../../models/GameResult.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import mongoose from "mongoose";

export const cancelGame = async (req, res) => {
    const { id } = req.body;
    const userId = req.session._id;

    if (!id) {
        return responseBadRequest(res, "Invalid bet id");
    }

    const bettingHistory = await BettingResultModel.findOne({ _id: id, user_id: userId });
    if (!bettingHistory) {
        return responseBadRequest(res, "Bet not found");
    }

    if (bettingHistory.betting_status !== "wait") {
        return responseBadRequest(res, "Bet cannot be cancelled");
    }

    const game = await GameResultModel.findOne({ game_id: bettingHistory.game_id });
    if (!game || !game.start_time_stamp) {
        return responseBadRequest(res, "Game not available for cancellation");
    }

    const secondsUntilStart = Math.floor((game.start_time_stamp - getCurrentTime()) / 1000);
    if (secondsUntilStart < 90 || secondsUntilStart > 180) {
        return responseBadRequest(res, "Cancellation window is closed");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const result = await BettingResultModel.updateOne(
            { _id: id, user_id: userId, betting_status: "wait" },
            {
                $set: {
                    betting_status: "cancel",
                    history_view: true,
                },
            },
            { session }
        );

        if (!result.modifiedCount) {
            await session.abortTransaction();
            return responseBadRequest(res, "Bet cancellation failed");
        }

        await UserModel.updateOne(
            { _id: userId },
            { $inc: { current_balance: bettingHistory.bet_amount } },
            { session }
        );

        await session.commitTransaction();

        return responseSuccess(res, { bettingAmount: bettingHistory.bet_amount });
    } catch (error) {
        await session.abortTransaction();
        return responseBadRequest(res, "Bet cancellation failed");
    } finally {
        session.endSession();
    }
};