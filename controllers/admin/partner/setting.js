import isEmpty from "is-empty";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js"
import GameSettingModel from "../../../models/GameSetting.js"

export const getGameSetting = async (req, res) => {
    try {
        const { name } = req.query;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return responseBadRequest(res, "Game setting name is required");
        }

        const gameSetting = await GameSettingModel.findOne({ name: name.trim() });

        let result;
        if (isEmpty(gameSetting)) {
            result = await GameSettingModel.create({ name: name.trim() });
        } else {
            result = gameSetting;
        }

        responseSuccess(res, result);
    } catch (error) {
        console.error('[getGameSetting] Error:', error);
        return responseServerError(res);
    }
}

export const updateGameSetting = async (req, res) => {
    try {
        const { name } = req.query;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return responseBadRequest(res, "Game setting name is required");
        }

        const {
            activate,
            inactive_message,
            duplicate_betting,
            duplicate_betting_limit,
            option
        } = req.body;

        if (activate !== undefined && typeof activate !== 'boolean') {
            return responseBadRequest(res, "activate must be a boolean");
        }

        if (inactive_message !== undefined && typeof inactive_message !== 'string') {
            return responseBadRequest(res, "inactive_message must be a string");
        }

        if (duplicate_betting !== undefined && typeof duplicate_betting !== 'boolean') {
            return responseBadRequest(res, "duplicate_betting must be a boolean");
        }

        if (duplicate_betting_limit !== undefined) {
            const limit = Number(duplicate_betting_limit);
            if (isNaN(limit) || limit < 0) {
                return responseBadRequest(res, "duplicate_betting_limit must be a non-negative number");
            }
        }

        if (option !== undefined) {
            if (!Array.isArray(option)) {
                return responseBadRequest(res, "option must be an array");
            }

            for (let i = 0; i < option.length; i++) {
                const opt = option[i];
                if (!opt || typeof opt !== 'object') {
                    return responseBadRequest(res, `option[${i}] must be an object`);
                }

                if (!opt.name || typeof opt.name !== 'string') {
                    return responseBadRequest(res, `option[${i}].name is required and must be a string`);
                }

                const numericFields = [
                    'odd', 'even', 'under', 'over',
                    'odd_under', 'odd_over', 'even_under', 'even_over',
                    'match_number1', 'match_number2', 'match_number3'
                ];

                for (const field of numericFields) {
                    if (opt[field] !== undefined) {
                        const value = Number(opt[field]);
                        if (isNaN(value) || value < 0) {
                            return responseBadRequest(res, `option[${i}].${field} must be a non-negative number`);
                        }
                    }
                }
            }
        }

        const existingSetting = await GameSettingModel.findOne({ name: name.trim() });
        if (!existingSetting) {
            return responseBadRequest(res, "Game setting not found");
        }

        const updateData = {};
        if (activate !== undefined) updateData.activate = activate;
        if (inactive_message !== undefined) updateData.inactive_message = inactive_message;
        if (duplicate_betting !== undefined) updateData.duplicate_betting = duplicate_betting;
        if (duplicate_betting_limit !== undefined) updateData.duplicate_betting_limit = Number(duplicate_betting_limit);
        if (option !== undefined) updateData.option = option;

        await GameSettingModel.updateOne(
            { name: name.trim() },
            { $set: updateData }
        );

        const updatedSetting = await GameSettingModel.findOne({ name: name.trim() });
        responseSuccess(res, updatedSetting, "Game setting updated successfully");
    } catch (error) {
        console.error('[updateGameSetting] Error:', error);
        return responseServerError(res);
    }
}