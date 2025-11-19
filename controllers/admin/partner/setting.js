import isEmpty from "is-empty";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js"
import GameSettingModel from "../../../models/GameSetting.js"
import { t } from "../../../helper/translation.js";

export const getGameSetting = async (req, res) => {
    try {
        const { name } = req.query;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return responseBadRequest(res, t("game_setting_name_required"));
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
        console.error('Get Game Setting Error:', error);
        return responseServerError(res);
    }
}

export const updateGameSetting = async (req, res) => {
    try {
        const { name } = req.query;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return responseBadRequest(res, t("game_setting_name_required"));
        }

        const {
            activate,
            inactive_message,
            duplicate_betting,
            duplicate_betting_limit,
            option
        } = req.body;

        if (activate !== undefined && typeof activate !== 'boolean') {
            return responseBadRequest(res, t("activate_must_be_boolean"));
        }

        if (inactive_message !== undefined && typeof inactive_message !== 'string') {
            return responseBadRequest(res, t("inactive_message_must_be_string"));
        }

        if (duplicate_betting !== undefined && typeof duplicate_betting !== 'boolean') {
            return responseBadRequest(res, t("duplicate_betting_must_be_boolean"));
        }

        if (duplicate_betting_limit !== undefined) {
            const limit = Number(duplicate_betting_limit);
            if (isNaN(limit) || limit < 0) {
                return responseBadRequest(res, t("duplicate_betting_limit_must_be_non_negative"));
            }
        }

        if (activate === false && (!inactive_message || typeof inactive_message !== 'string' || inactive_message.trim() === '')) {
            return responseBadRequest(res, t("inactive_message_required_when_disabled"));
        }

        if (option !== undefined) {
            if (!Array.isArray(option)) {
                return responseBadRequest(res, t("option_must_be_array"));
            }

            if (option.length !== 2) {
                return responseBadRequest(res, t("option_must_contain_exactly_2_items"));
            }

            for (let i = 0; i < option.length; i++) {
                const opt = option[i];
                if (!opt || typeof opt !== 'object') {
                    return responseBadRequest(res, t("option_index_must_be_object", i));
                }

                if (!opt.name || typeof opt.name !== 'string') {
                    return responseBadRequest(res, t("option_index_name_required", i));
                }

                if (opt.name !== 'A' && opt.name !== 'B') {
                    return responseBadRequest(res, t("option_index_name_must_be_a_or_b", i));
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
                            return responseBadRequest(res, t("option_index_field_must_be_non_negative", i, field));
                        }
                    }
                }
            }
        }

        const existingSetting = await GameSettingModel.findOne({ name: name.trim() });
        if (!existingSetting) {
            return responseBadRequest(res, t("game_setting_not_found"));
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
        responseSuccess(res, updatedSetting, t("game_setting_updated_successfully"));
    } catch (error) {
        console.error('Update Game Setting Error:', error);
        return responseServerError(res);
    }
}