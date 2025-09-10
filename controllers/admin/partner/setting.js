import isEmpty from "is-empty";
import { responseSuccess } from "../../../helper/response.js"
import GameSettingModel from "../../../models/GameSetting.js"

export const getGameSetting = async (req, res) => {
    const { name } = req.query;
    const gameSetting = await GameSettingModel.findOne({ name: name });

    let result;
    if (isEmpty(gameSetting)) {
        result = await GameSettingModel.create({ name: name })
    } else {
        result = gameSetting
    }

    responseSuccess(res, result)
}

export const updateGameSetting = async (req, res) => {
    const { name } = req.query;

    await GameSettingModel.updateOne({ name: name }, req.body);
    responseSuccess(res)
}