import BettingResultModel from "../../models/BettingResult.js";
import GameResultModel from "../../models/GameResult.js";

export const getGameWithBettingHistory = async (gameId, userId) => {
    const game = await GameResultModel.findOne({ game_id: gameId });
    const bettingHistory = await BettingResultModel
        .find({ game_id: gameId, user_id: userId })
        .select({
            _id: 1,
            game_id: 1,
            betting_type: 1,
            betting_rate: 1,
            bet_amount: 1,
            number_sort: 1,
            win: 1,
            earning_amount: 1,
            betting_status: 1
        });

    return {
        game,
        bettingHistory
    }
}