import GameSettingModel from "../../../models/GameSetting.js";
import PartnerModel from "../../../models/Partner.js";
import UserModel from "../../../models/User.js";
import { responseBadRequest, responseSuccess, responseUnAutherized } from "../../../helper/response.js";
import { partnerType } from "../../../const/type.js";

export const getGameOption = async (req, res) => {
    try {
        const userId = req.session._id;
        console.log('[getGameOption] User ID from session:', userId);

        if (!userId) {
            console.log('[getGameOption] No userId in session');
            return responseUnAutherized(res);
        }

        const user = await UserModel.findOne({ _id: userId }).lean();
        console.log('[getGameOption] User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            return responseUnAutherized(res);
        }

        let partnerId = user.own_partner_id || user.partner_id || '';
        console.log('[getGameOption] Partner ID:', partnerId);
        
        let partner;
        
        if (!partnerId) {
            console.log('[getGameOption] User does not have partner_id, creating default partner');
            // Create a default partner for the user
            const defaultPartner = await PartnerModel.create({
                role: partnerType.store,
                nickname: `${user.user_nickname || 'User'}_Partner`,
                partner_id: `PARTNER_${user._id}`,
                user_id: user._id,
                bet_rate_type: 'A',
                dashboard_access_permission: false,
            });
            
            // Update user with the new partner ID
            await UserModel.findByIdAndUpdate(user._id, {
                partner_id: defaultPartner._id
            });
            
            partnerId = defaultPartner._id;
            partner = defaultPartner.toObject();
            console.log('[getGameOption] Created default partner:', partnerId);
        } else {
            partner = await PartnerModel.findOne({ _id: partnerId }).lean();
            console.log('[getGameOption] Partner found:', partner ? 'Yes' : 'No');
            
            if (!partner) {
                console.log('[getGameOption] Partner not found, creating default partner');
                // Partner was deleted or doesn't exist, create a new one
                const defaultPartner = await PartnerModel.create({
                    role: partnerType.store,
                    nickname: `${user.user_nickname || 'User'}_Partner`,
                    partner_id: `PARTNER_${user._id}`,
                    user_id: user._id,
                    bet_rate_type: 'A',
                    dashboard_access_permission: false,
                });
                
                // Update user with the new partner ID
                await UserModel.findByIdAndUpdate(user._id, {
                    partner_id: defaultPartner._id
                });
                
                partnerId = defaultPartner._id;
                partner = defaultPartner.toObject();
                console.log('[getGameOption] Created replacement partner:', partnerId);
            }
        }

        const gameSetting = await GameSettingModel.find().lean();
        console.log('[getGameOption] Game settings found:', gameSetting.length);
        
        if (!gameSetting || gameSetting.length === 0) {
            console.log('[getGameOption] No game settings found');
            // Return default values if game settings don't exist
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

        if (!gameSetting[0].option || gameSetting[0].option.length === 0) {
            console.log('[getGameOption] No options in game settings');
            // Return default values if options don't exist
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

        const betRateType = partner.bet_rate_type || 'A';
        console.log('[getGameOption] Bet rate type:', betRateType);
        console.log('[getGameOption] Available options:', gameSetting[0].option.map(o => o.name));
        
        const option = gameSetting[0].option.filter(item => item.name == betRateType);
        console.log('[getGameOption] Filtered options:', option.length);

        if (!option || option.length === 0) {
            console.log(`[getGameOption] Betting rate type '${betRateType}' not found, using first option or defaults`);
            // Use first available option or defaults
            const firstOption = gameSetting[0].option[0];
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
                // Fallback to defaults
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
        console.log('[getGameOption] Selected option:', selectedOption);

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
        console.error('[getGameOption] Error:', error);
        console.error('[getGameOption] Error stack:', error.stack);
        return responseBadRequest(res, `Error fetching game options: ${error.message}`);
    }
}