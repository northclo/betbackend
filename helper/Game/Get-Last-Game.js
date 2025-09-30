import GameResultModel from "../../models/GameResult.js";

export const getLastGame = async () => {
    const gameHistory = await GameResultModel
        .find({ end_time_stamp: { $exists: true } })
        .sort({ start_time_stamp: -1 });

    return gameHistory[0] || {}
}