import GameSettingModel from "../../../models/GameSetting.js";
import PartnerModel from "../../../models/Partner.js";
import UserModel from "../../../models/User.js";
import { responseBadRequest, responseSuccess, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const getGameOption = async (req, res) => {
    try {
        const userId = req.session._id;

        if (!userId) {
            return responseUnAutherized(res);
        }

        const user = await UserModel.findOne({ _id: userId }).lean();
        
        if (!user) {
            return responseUnAutherized(res);
        }

        const partnerId = user.partner_id || '';
        
        let partner = null;
        if (partnerId) {
            partner = await PartnerModel.findOne({ partner_id: partnerId }).lean();
        }

        const gameSetting = await GameSettingModel.findOne({ name: 'PowerballGame' }).lean();
        
        if (!gameSetting) {
            return responseSuccess(res, {
                odd: 195,
                even: 195,
                under: 195,
                over: 195,
                odd_under: 245,
                odd_over: 245,
                even_under: 245,
                even_over: 245,
                match_number1: 950,
                match_number2: 1950,
                match_number3: 99900,
            });
        }

        if (!gameSetting.option || gameSetting.option.length === 0) {
            return responseSuccess(res, {
                odd: 195,
                even: 195,
                under: 195,
                over: 195,
                odd_under: 245,
                odd_over: 245,
                even_under: 245,
                even_over: 245,
                match_number1: 950,
                match_number2: 1950,
                match_number3: 99900,
            });
        }

        const betRateType = partner?.bet_rate_type || 'A';
        
        const option = gameSetting.option.filter(item => item.name == betRateType);

        if (!option || option.length === 0) {
            const firstOption = gameSetting.option[0];
            if (firstOption) {
                return responseSuccess(res, {
                    odd: firstOption.odd || 195,
                    even: firstOption.even || 195,
                    under: firstOption.under || 195,
                    over: firstOption.over || 195,
                    odd_under: firstOption.odd_under || 245,
                    odd_over: firstOption.odd_over || 245,
                    even_under: firstOption.even_under || 245,
                    even_over: firstOption.even_over || 245,
                    match_number1: firstOption.match_number1 || 950,
                    match_number2: firstOption.match_number2 || 1950,
                    match_number3: firstOption.match_number3 || 99900,
                });
            } else {
                return responseSuccess(res, {
                    odd: 195,
                    even: 195,
                    under: 195,
                    over: 195,
                    odd_under: 245,
                    odd_over: 245,
                    even_under: 245,
                    even_over: 245,
                    match_number1: 950,
                    match_number2: 1950,
                    match_number3: 99900,
                });
            }
        }

        const selectedOption = option[0];

        return responseSuccess(res, {
            odd: selectedOption.odd || 195,
            even: selectedOption.even || 195,
            under: selectedOption.under || 195,
            over: selectedOption.over || 195,
            odd_under: selectedOption.odd_under || 245,
            odd_over: selectedOption.odd_over || 245,
            even_under: selectedOption.even_under || 245,
            even_over: selectedOption.even_over || 245,
            match_number1: selectedOption.match_number1 || 950,
            match_number2: selectedOption.match_number2 || 1950,
            match_number3: selectedOption.match_number3 || 99900,
        });
    } catch (error) {
        console.error('Game Option Error:', error);
        return responseServerError(res);
    }
}