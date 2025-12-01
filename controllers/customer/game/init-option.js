import GameSettingModel from "../../../models/GameSetting.js";
import PartnerModel from "../../../models/Partner.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseUnAutherized, responseServerError } from "../../../helper/response.js";

export const getGameOption = async (req, res) => {
    try {
        const userId = req.session._id;

        if (!userId) {
            return responseUnAutherized(res);
        }

        let user = await UserModel.findOne({ _id: userId }).lean();
        let partnerObjectId = null;
        if (!user) {
            user = await PartnerModel.findById(userId).lean();
            if (!user) return responseUnAutherized(res);
            partnerObjectId = user._id;
        } else partnerObjectId = user.partner_id || user.ownpartner_id;

        let partner = null;
        if (partnerObjectId) {
            partner = await PartnerModel.findOne({ _id: partnerObjectId }).lean();
        }

        const gameSetting = await GameSettingModel.findOne({ name: 'PowerballGame' }).lean();

        const defaultRates = {
            odd: 1.95,
            even: 1.95,
            under: 1.95,
            over: 1.95,
            odd_under: 2.45,
            odd_over: 2.45,
            even_under: 2.45,
            even_over: 2.45,
            match_number1: 9.5,
            match_number2: 19.5,
            match_number3: 19.5,
        };

        const bettingLimits = partner ? {
            bet_money_unit: partner.bet_money_unit || null,
            onetime_bet_min: partner.onetime_bet_min || null,
            onetime_bet_max: partner.onetime_bet_max || null,
            onetime_earning_max: partner.onetime_earning_max || null,
            oneround_bet_max: partner.oneround_bet_max || null,
            oneround_earning_max: partner.oneround_earning_max || null,
            oneround_bet_max_slot: partner.oneround_bet_max_slot || null,
            oneround_earning_max_slot: partner.oneround_earning_max_slot || null,
            all_rounds_bet_max: partner.all_rounds_bet_max || null,
        } : null;
        
        if (!gameSetting) {
            return responseSuccess(res, {
                ...defaultRates,
                bettingLimits
            });
        }

        if (!gameSetting.option || gameSetting.option.length === 0) {
            return responseSuccess(res, {
                ...defaultRates,
                bettingLimits
            });
        }

        const betRateType = partner?.bet_rate_type || 'A';
        
        const option = gameSetting.option.filter(item => item.name == betRateType);

        if (!option || option.length === 0) {
            const firstOption = gameSetting.option[0];
            if (firstOption) {
                const fallbackRates = {
                    odd: firstOption.odd || 1.95,
                    even: firstOption.even || 1.95,
                    under: firstOption.under || 1.95,
                    over: firstOption.over || 1.95,
                    odd_under: firstOption.odd_under || 2.45,
                    odd_over: firstOption.odd_over || 2.45,
                    even_under: firstOption.even_under || 2.45,
                    even_over: firstOption.even_over || 2.45,
                    match_number1: firstOption.match_number1 || 2.45,
                    match_number2: firstOption.match_number2 || 2.45,
                    match_number3: firstOption.match_number3 || 2.45,
                };
                return responseSuccess(res, {
                    ...fallbackRates,
                    bettingLimits
                });
            } else {
                return responseSuccess(res, {
                    ...defaultRates,
                    bettingLimits
                });
            }
        }

        const selectedOption = option[0];

        const baseRates = {
            odd: selectedOption.odd || 1.95,
            even: selectedOption.even || 1.95,
            under: selectedOption.under || 1.95,
            over: selectedOption.over || 1.95,
            odd_under: selectedOption.odd_under || 2.45,
            odd_over: selectedOption.odd_over || 2.45,
            even_under: selectedOption.even_under || 2.45,
            even_over: selectedOption.even_over || 2.45,
            match_number1: selectedOption.match_number1 || 2.45,
            match_number2: selectedOption.match_number2 || 2.45,
            match_number3: selectedOption.match_number3 || 2.45,
        };

        return responseSuccess(res, {
            ...baseRates,
            bettingLimits
        });
    } catch (error) {
        console.error('Game Option Error:', error);
        return responseServerError(res);
    }
}