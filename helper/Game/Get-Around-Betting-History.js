import BettingResultModel from "../../models/BettingResult.js";
import GameResultModel from "../../models/GameResult.js";
import { getCurrentTime } from "../Time/Get-Current-Time.js";
import mongoose from "mongoose";

export const getAroundBettingHistory = async (gameId, userId) => {
    let previousGameId = null;
    let nextGameId = null;

    const userBettingGamesResult = await BettingResultModel.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: "$game_id" } },
        { $project: { _id: 0, game_id: "$_id" } }
    ]);

    const userBettingGames = userBettingGamesResult.map(item => item.game_id);

    if (userBettingGames.length === 0) {
        return { previousGameId: null, nextGameId: null };
    }

    const currentGame = await GameResultModel
        .findOne({ game_id: gameId })
        .select({ start_time_stamp: 1 })
        .lean();

    if (!currentGame || !currentGame.start_time_stamp) {
        return { previousGameId, nextGameId };
    }

    const currentTimestamp = currentGame.start_time_stamp;
    const maxTimestamp = getCurrentTime() + 180000;

    if (userBettingGames.length > 0) {
        const previousGame = await GameResultModel
            .findOne({
                game_id: { $in: userBettingGames },
                start_time_stamp: {
                    $lt: Math.min(currentTimestamp, maxTimestamp)
                }
            })
            .sort({ start_time_stamp: -1 })
            .select({ game_id: 1 })
            .limit(1)
            .lean();

        if (previousGame) {
            previousGameId = previousGame.game_id;
        }

        const nextGame = await GameResultModel
            .findOne({
                game_id: { $in: userBettingGames },
                start_time_stamp: {
                    $gt: currentTimestamp,
                    $lte: maxTimestamp
                }
            })
            .sort({ start_time_stamp: 1 })
            .select({ game_id: 1 })
            .limit(1)
            .lean();

        if (nextGame) {
            nextGameId = nextGame.game_id;
        }
    }

    return { previousGameId, nextGameId };
}

