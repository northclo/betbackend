import GameResultModel from "../../models/GameResult.js";
import { getCurrentTime } from "../Time/Get-Current-Time.js";

export const getAroundGameId = async (gameId) => {
    let previousGameId = null;
    let nextGameId = null;

    const gameIdLists = await GameResultModel
        .find({
            $or: [
                { start_time_stamp: { $lt: getCurrentTime() } },
                { start_time_stamp: { $gt: getCurrentTime() + 180000 } }
            ]
        })
        .sort({ start_time_stamp: -1 })
        .select({ _id: 0, game_id: 1 });

    gameIdLists.forEach((element, idx) => {
        if (element.game_id === gameId) {
            if (idx !== gameIdLists.length - 1) previousGameId = gameIdLists[idx + 1].game_id
            if (idx !== 0) nextGameId = gameIdLists[idx - 1].game_id
        }
    });

    return { previousGameId, nextGameId }
}