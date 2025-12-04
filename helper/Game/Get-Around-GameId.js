import GameResultModel from "../../models/GameResult.js";
import { getCurrentTime } from "../Time/Get-Current-Time.js";

export const getAroundGameId = async (gameId) => {
    let previousGameId = null;
    let nextGameId = null;

    const currentGame = await GameResultModel
        .findOne({ game_id: gameId })
        .select({ start_time_stamp: 1 })
        .lean();

    if (!currentGame || !currentGame.start_time_stamp) {
        return { previousGameId, nextGameId };
    }

    const currentTimestamp = currentGame.start_time_stamp;
    const maxTimestamp = getCurrentTime() + 180000;

    const previousGame = await GameResultModel
        .findOne({
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

    return { previousGameId, nextGameId };
}