import BettingResultModel from "../../models/BettingResult.js";
import GameResultModel from "../../models/GameResult.js";
import { getCurrentTime } from "../Time/Get-Current-Time.js";

export const getAroundBettingHistory = async (gameId, userId) => {
    let previousGameId = null;
    let nextGameId = null;

    const userBettingGames = await BettingResultModel
        .find({ user_id: userId })
        .distinct('game_id');

    if (userBettingGames.length === 0) {
        return { previousGameId: null, nextGameId: null };
    }

    const gamesWithTimestamps = await GameResultModel
        .find({
            game_id: { $in: userBettingGames },
            start_time_stamp: { $lt: getCurrentTime() + 180000 }
        })
        .sort({ start_time_stamp: -1 })
        .select({ _id: 0, game_id: 1, start_time_stamp: 1 })
        .lean();

    const currentIndex = gamesWithTimestamps.findIndex(game => game.game_id === gameId);

    if (currentIndex !== -1) {
        if (currentIndex < gamesWithTimestamps.length - 1) {
            previousGameId = gamesWithTimestamps[currentIndex + 1].game_id;
        }
        if (currentIndex > 0) {
            nextGameId = gamesWithTimestamps[currentIndex - 1].game_id;
        }
    }

    return { previousGameId, nextGameId };
}

