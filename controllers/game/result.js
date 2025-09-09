import GameResultModel from "../../models/GameResult.js"
import { responseBadRequest, responseSuccess } from "../../helper/response.js";

export const startGame = async (req, res) => {
    const { game_id, device_id, time_stamp } = req.body;

    await GameResultModel.create({
        game_id: game_id,
        device_id: device_id,
        start_time_stamp: Date.now()
    })

    responseSuccess(res)
}

export const endGame = async (req, res) => {
    const { list, manual_valid, total_no, today_no, current_no, time_stamp, game_id, device_id } = req.body;

    const gameResult = await GameResultModel.findOne({ game_id: game_id });

    if (!gameResult) {
        return responseBadRequest(res);
    }

    await GameResultModel.updateOne({ game_id: game_id }, {
        list: list,
        total_no: total_no,
        today_no: today_no,
        end_time_stamp: time_stamp,
        current_no: current_no,
        device_id: device_id,
        manual_valid: manual_valid
    });

    return responseSuccess(res);
}