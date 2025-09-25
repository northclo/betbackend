import BettingResultModel from "../../../models/BettingResult.js";
import { responseServerError, responseSuccess } from "../../../helper/response.js";

export const StartGame = async (req, res) => {
    const { game_id, bettingType, bettingAmount, bettingRate, numberSort } = req.body;
    const userId = req.session._id;

    const result = await BettingResultModel.create({
        user_id: userId,
        game_id: game_id,
        betting_type: bettingType,
        betting_rate: bettingRate,
        bet_amount: bettingAmount,
        number_sort: numberSort
    })

    if (result) {
        return responseSuccess(res, {
            _id: result._id,
            bet_amount: result.bet_amount,
            betting_rate: result.betting_rate,
            betting_type: result.betting_type,
            game_id: result.game_id,
            number_sort: result.number_sort
        })
    } else {
        return responseServerError(res)
    }
}