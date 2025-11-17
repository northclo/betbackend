import BettingResultModel from "../../../models/BettingResult.js";
import GameResultModel from "../../../models/GameResult.js";
import { responseBadRequest, responseServerError, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import mongoose from "mongoose";
import { t } from "../../../helper/translation.js";

const VALID_BET_TYPES = new Set([
    "odd",
    "even",
    "under",
    "over",
    "odd_under",
    "odd_over",
    "even_under",
    "even_over",
    "number_13",
    "number_14",
    "number_16",
]);

const NUMBER_SORT_LENGTH = {
    number_13: 3,
    number_14: 4,
    number_16: 6,
};

export const StartGame = async (req, res) => {
    const { game_id, bettingType, bettingAmount, bettingRate, numberSort } = req.body;
    const userId = req.session._id;

    if (!game_id || !VALID_BET_TYPES.has(bettingType)) {
        return responseBadRequest(res, t("invalid_betting_request"));
    }

    const amount = Number(bettingAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return responseBadRequest(res, t("betting_amount_positive"));
    }

    const rate = Number(bettingRate);
    if (!Number.isFinite(rate) || rate <= 0) {
        return responseBadRequest(res, t("betting_rate_positive"));
    }

    let sanitizedNumberSort = [];
    if (NUMBER_SORT_LENGTH[bettingType]) {
        if (!Array.isArray(numberSort) || numberSort.length !== NUMBER_SORT_LENGTH[bettingType]) {
            return responseBadRequest(res, t("number_sort_invalid"));
        }

        sanitizedNumberSort = numberSort.map((val) => Number(val));
        const allNumbers = sanitizedNumberSort.every(
            (val) => Number.isInteger(val) && val >= 1 && val <= 6
        );
        if (!allNumbers) {
            return responseBadRequest(res, t("number_sort_values_range"));
        }

        const uniqueCount = new Set(sanitizedNumberSort).size;
        if (uniqueCount !== sanitizedNumberSort.length) {
            return responseBadRequest(res, t("number_sort_values_unique"));
        }

        sanitizedNumberSort.sort((a, b) => a - b);
    }

    const user = await UserModel.findOne({ _id: userId });
    if (!user) {
        return responseBadRequest(res, t("user_not_found"));
    }

    const availableBalance = user.own_money ?? 0;

    const game = await GameResultModel.findOne({ game_id });
    if (!game || !game.start_time_stamp) {
        return responseBadRequest(res, t("game_not_available_betting"));
    }

    const secondsUntilStart = Math.floor((game.start_time_stamp - getCurrentTime()) / 1000);
    if (secondsUntilStart < 90 || secondsUntilStart > 180) {
        return responseBadRequest(res, t("betting_window_closed"));
    }

    if (availableBalance < amount) {
        return responseBadRequest(res, t("not_enough_balance"));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const result = await BettingResultModel.create([{
            user_id: userId,
            game_id,
            betting_type: bettingType,
            betting_rate: rate,
            bet_amount: amount,
            number_sort: sanitizedNumberSort,
            betting_status: "wait",
            win: false,
            earning_amount: 0,
            history_view: true,
        }], { session });

        const updateBalance = await UserModel.updateOne(
            { _id: userId },
            { $inc: { own_money: -amount } },
            { session }
        );

        if (!updateBalance.modifiedCount) {
            await session.abortTransaction();
            return responseBadRequest(res, t("failed_update_balance"));
        }

        await session.commitTransaction();

        const createdBet = result[0];
        return responseSuccess(res, {
            _id: createdBet._id,
            bet_amount: createdBet.bet_amount,
            betting_rate: createdBet.betting_rate,
            betting_type: createdBet.betting_type,
            game_id: createdBet.game_id,
            number_sort: createdBet.number_sort,
            betting_status: createdBet.betting_status,
            win: createdBet.win,
            earning_amount: createdBet.earning_amount,
            history_view: createdBet.history_view,
        });
    } catch (error) {
        await session.abortTransaction();
        return responseServerError(res);
    } finally {
        session.endSession();
    }
};