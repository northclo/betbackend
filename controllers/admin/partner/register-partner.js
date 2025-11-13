import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { responseBadRequest, responseSuccess } from '../../../helper/response.js';
import PartnerModel from '../../../models/Partner.js';
import UserModel from '../../../models/User.js';
import { partnerType } from '../../../const/type.js';

export const registerPartner = async (req, res) => {
    try {
        const payload = req.body;
        const userId = req.session._id;

        // Validate required fields
        if (!payload.partnerId || !payload.partnerId.trim()) {
            return responseBadRequest(res, "Partner ID is required");
        }

        if (!payload.nickname || !payload.nickname.trim()) {
            return responseBadRequest(res, "Nickname is required");
        }

        if (!payload.password || !payload.password.trim()) {
            return responseBadRequest(res, "Password is required");
        }

        // Check if partner_id already exists
        const existingPartner = await PartnerModel.findOne({ partner_id: payload.partnerId.trim() });
        if (existingPartner) {
            return responseBadRequest(res, "Partner ID already exists");
        }

        // Check if user nickname already exists
        const existingUser = await UserModel.findOne({ user_nickname: payload.nickname.trim() });
        if (existingUser) {
            return responseBadRequest(res, "User nickname already exists");
        }

        // Get parent partner from current user
        const currentUser = await UserModel.findById(userId);
        if (!currentUser) {
            return responseBadRequest(res, "Current user not found");
        }

        const parentPartnerId = currentUser.own_partner_id || payload.parentPartnerId;
        if (!parentPartnerId) {
            return responseBadRequest(res, "Parent partner not found");
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(payload.password, salt);

        // Create user for the partner owner
        const newUser = await UserModel.create({
            user_nickname: payload.nickname.trim(),
            user_email: payload.nickname.trim() + '@gmail.com',
            password: hashedPassword,
            user_name: payload.name || payload.nickname.trim(),
            phone_number: payload.phoneNumber || '',
            bank_id: payload.bank || '',
            bank_number: payload.account || '',
            bank_owner_name: payload.name || '',
            simple_bet_rate: payload.dapol ? Number(payload.dapol) : null,
            combined_bet_rate: payload.danpol ? Number(payload.danpol) : null,
            match_num_bet_rate: payload.numberMatch ? Number(payload.numberMatch) : null,
        });

        // Determine partner role (default to branch_office if not specified)
        const role = payload.role || partnerType.branchOffice;

        // Create partner
        const newPartner = await PartnerModel.create({
            role: role,
            nickname: payload.nickname.trim(),
            partner_id: payload.partnerId.trim(),
            user_id: newUser._id,
            parent_partner_id: new mongoose.Types.ObjectId(parentPartnerId),
            currency_rolling: payload.currencyRolling?.check || false,
            deposit_approved_amount: payload.currencyRolling?.amount ? Number(payload.currencyRolling.amount) : 0,
            dashboard_access_permission: payload.permissions?.parnterPageAccess || false,
            sub_partner_creation_permission: payload.permissions?.subPartnerCreate || false,
            user_creation_permission: payload.permissions?.memberCreate || false,
            sub_partner_settlement_rate: payload.permissions?.partnerSettlement || false,
            sub_partner_money_change: payload.permissions?.moneyChange || false,
            bet_rate_type: payload.gameSetting?.dividendType || 'A',
            deadline: payload.gameSetting?.deadline ? Number(payload.gameSetting.deadline) : null,
            cancel_bet: payload.gameSetting?.cancelBet || false,
            cancel_bet_range: payload.gameSetting?.cancelBet ? {
                end_time: payload.gameSetting.cancelBetEndTime ? Number(payload.gameSetting.cancelBetEndTime) : 0,
                max_time: payload.gameSetting.cancelBetMaxTime ? Number(payload.gameSetting.cancelBetMaxTime) : 0,
                perday_time: payload.gameSetting.cancelBetPerday ? Number(payload.gameSetting.cancelBetPerday) : 0,
            } : undefined,
            bet_money_unit: payload.gameSetting?.betUnit || '',
            onetime_bet_min: payload.gameSetting?.oneTimeBetMin ? Number(payload.gameSetting.oneTimeBetMin) : null,
            onetime_bet_max: payload.gameSetting?.oneTimeBetMax ? Number(payload.gameSetting.oneTimeBetMax) : null,
            onetime_earning_max: payload.gameSetting?.oneTimeEarningMax ? Number(payload.gameSetting.oneTimeEarningMax) : null,
            oneround_bet_max: payload.gameSetting?.oneRoundBetMax ? Number(payload.gameSetting.oneRoundBetMax) : null,
            oneround_earning_max: payload.gameSetting?.oneRoundEarningMax ? Number(payload.gameSetting.oneRoundEarningMax) : null,
            oneround_bet_max_slot: payload.gameSetting?.oneRoundBetMaxPerSlot ? Number(payload.gameSetting.oneRoundBetMaxPerSlot) : null,
            oneround_earning_max_slot: payload.gameSetting?.oneRoundEarningMaxPerSlot ? Number(payload.gameSetting.oneRoundEarningMaxPerSlot) : null,
            all_rounds_bet_max: payload.gameSetting?.allRoundsBetMax ? Number(payload.gameSetting.allRoundsBetMax) : null,
        });

        // Update user with own_partner_id
        await UserModel.findByIdAndUpdate(newUser._id, {
            own_partner_id: newPartner._id
        });

        return responseSuccess(res, {
            partner: newPartner,
            user: newUser
        });
    } catch (error) {
        console.error('Error registering partner:', error);
        return responseBadRequest(res, error.message || "Failed to register partner");
    }
};

