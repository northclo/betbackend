import BettingResultModel from "../../../models/BettingResult.js";
import GameResultModel from "../../../models/GameResult.js";
import { responseBadRequest, responseServerError, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import mongoose from "mongoose";

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
        return responseBadRequest(res, "Invalid betting request");
    }

    const amount = Number(bettingAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return responseBadRequest(res, "Betting amount must be a positive number");
    }

    const rate = Number(bettingRate);
    if (!Number.isFinite(rate) || rate <= 0) {
        return responseBadRequest(res, "Betting rate must be a positive number");
    }

    let sanitizedNumberSort = [];
    if (NUMBER_SORT_LENGTH[bettingType]) {
        if (!Array.isArray(numberSort) || numberSort.length !== NUMBER_SORT_LENGTH[bettingType]) {
            return responseBadRequest(res, "Number sort is invalid");
        }

        sanitizedNumberSort = numberSort.map((val) => Number(val));
        const allNumbers = sanitizedNumberSort.every(
            (val) => Number.isInteger(val) && val >= 1 && val <= 6
        );
        if (!allNumbers) {
            return responseBadRequest(res, "Number sort values must be integers from 1 to 6");
        }

        const uniqueCount = new Set(sanitizedNumberSort).size;
        if (uniqueCount !== sanitizedNumberSort.length) {
            return responseBadRequest(res, "Number sort values must be unique");
        }

        sanitizedNumberSort.sort((a, b) => a - b);
    }

    const user = await UserModel.findOne({ _id: userId });
    if (!user) {
        return responseBadRequest(res, "User not found");
    }

    const availableBalance = user.current_balance ?? 0;

    const game = await GameResultModel.findOne({ game_id });
    if (!game || !game.start_time_stamp) {
        return responseBadRequest(res, "Game not available for betting");
    }

    const secondsUntilStart = Math.floor((game.start_time_stamp - getCurrentTime()) / 1000);
    if (secondsUntilStart < 90 || secondsUntilStart > 180) {
        return responseBadRequest(res, "Betting window is closed");
    }

    if (availableBalance < amount) {
        return responseBadRequest(res, "Not enough balance");
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
            { $inc: { current_balance: -amount } },
            { session }
        );

        if (!updateBalance.modifiedCount) {
            await session.abortTransaction();
            return responseBadRequest(res, "Failed to update balance");
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