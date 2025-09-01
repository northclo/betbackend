import { responseSuccess } from "../../../helper/response.js"
import GameSettingModel from "../../../models/game-setting.js"

export const getGameSetting = async (req, res) => {
    const { name } = req.query;
    const gameSetting = await GameSettingModel.findOne({ name: name })
    responseSuccess(res, '', gameSetting)
}

export const updateGameSetting = async (req, res) => {
    const { name } = req.query;
    await GameSettingModel.updateOne({ name: name }, req.body);
    responseSuccess(res)
}