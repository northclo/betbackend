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
        
        const applyUserRates = (baseRates) => {
            const simpleBetRateMultiplier = (user?.simple_bet_rate && user.simple_bet_rate > 0) 
                ? user.simple_bet_rate / 100 
                : 1;
            const combinedBetRateMultiplier = (user?.combined_bet_rate && user.combined_bet_rate > 0) 
                ? user.combined_bet_rate / 100 
                : 1;
            const matchNumBetRateMultiplier = (user?.match_num_bet_rate && user.match_num_bet_rate > 0) 
                ? user.match_num_bet_rate / 100 
                : 1;

            return {
                odd: Math.round(baseRates.odd * simpleBetRateMultiplier),
                even: Math.round(baseRates.even * simpleBetRateMultiplier),
                under: Math.round(baseRates.under * simpleBetRateMultiplier),
                over: Math.round(baseRates.over * simpleBetRateMultiplier),
                odd_under: Math.round(baseRates.odd_under * combinedBetRateMultiplier),
                odd_over: Math.round(baseRates.odd_over * combinedBetRateMultiplier),
                even_under: Math.round(baseRates.even_under * combinedBetRateMultiplier),
                even_over: Math.round(baseRates.even_over * combinedBetRateMultiplier),
                match_number1: Math.round(baseRates.match_number1 * matchNumBetRateMultiplier),
                match_number2: Math.round(baseRates.match_number2 * matchNumBetRateMultiplier),
                match_number3: Math.round(baseRates.match_number3 * matchNumBetRateMultiplier),
            };
        };

        const defaultRates = {
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
                ...applyUserRates(defaultRates),
                bettingLimits
            });
        }

        if (!gameSetting.option || gameSetting.option.length === 0) {
            return responseSuccess(res, {
                ...applyUserRates(defaultRates),
                bettingLimits
            });
        }

        const betRateType = partner?.bet_rate_type || 'A';
        
        const option = gameSetting.option.filter(item => item.name == betRateType);

        if (!option || option.length === 0) {
            const firstOption = gameSetting.option[0];
            if (firstOption) {
                const fallbackRates = {
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
                };
                return responseSuccess(res, {
                    ...applyUserRates(fallbackRates),
                    bettingLimits
                });
            } else {
                return responseSuccess(res, {
                    ...applyUserRates(defaultRates),
                    bettingLimits
                });
            }
        }

        const selectedOption = option[0];

        const baseRates = {
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
        };


        return responseSuccess(res, {
            ...applyUserRates(baseRates),
            bettingLimits
        });
    } catch (error) {
        console.error('Game Option Error:', error);
        return responseServerError(res);
    }
}