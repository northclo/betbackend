import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { responseBadRequest, responseSuccess, responseServerError, responseUnAutherized, responsePermissionDenied } from '../../../helper/response.js';
import PartnerModel from '../../../models/Partner.js';
import { partnerType } from '../../../const/type.js';
import { t } from '../../../helper/translation.js';

export const registerPartner = async (req, res) => {
    try {
        const payload = req.body;
        const currentPartnerId = req.session?._id;

        if (!currentPartnerId) {
            return responseUnAutherized(res);
        }

        const currentPartner = await PartnerModel.findById(currentPartnerId).lean();
        if (!currentPartner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const isHeadquater = currentPartner.role === partnerType.headquater;
        const hasPartnerAccessPermission = currentPartner.partner_access_permission === true;

        if (!isHeadquater && !hasPartnerAccessPermission) {
            return responsePermissionDenied(res);
        }

        const hasSubPartnerCreationPermission = currentPartner.sub_partner_creation_permission === true;

        if (!isHeadquater && !hasSubPartnerCreationPermission) {
            return responsePermissionDenied(res);
        }

        if (!payload.partnerId || !payload.partnerId.trim()) {
            return responseBadRequest(res, t("partner_id_required"));
        }

        let parentPartnerId = currentPartnerId;
        if (payload.parentPartnerId) {
            const parentPartner = await PartnerModel.findOne({ partner_id: payload.parentPartnerId.trim() });
            if (!parentPartner) {
                return responseBadRequest(res, t("parent_partner_not_found"));
            }
            parentPartnerId = parentPartner._id;
        }

        const partnerIdRegex = /^[A-Za-z][\w\-@!]{2,9}$/;
        if (!partnerIdRegex.test(payload.partnerId.trim())) {
            return responseBadRequest(res, t("partner_id_invalid_format"));
        }

        if (!payload.nickname || !payload.nickname.trim()) {
            return responseBadRequest(res, t("nickname_required"));
        }

        const nicknameRegex = /^[A-Za-z][A-Za-z0-9_-]{2,9}$/;
        if (!nicknameRegex.test(payload.nickname.trim())) {
            return responseBadRequest(res, t("nickname_invalid_format"));
        }

        if (!payload.password || !payload.password.trim()) {
            return responseBadRequest(res, t("password_required"));
        }

        if (!payload.exchangePassword || !payload.exchangePassword.trim()) {
            return responseBadRequest(res, t("exchange_password_required"));
        }

        if (!payload.bank || !payload.bank.trim()) {
            return responseBadRequest(res, t("bank_required"));
        }

        if (!payload.account || !payload.account.trim()) {
            return responseBadRequest(res, t("bank_account_required"));
        }

        if (!payload.name || !payload.name.trim()) {
            return responseBadRequest(res, t("bank_owner_name_required"));
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(payload.password, salt);
        const hashedExchangePassword = await bcrypt.hash(payload.exchangePassword.trim(), salt);

        const role = payload.role || partnerType.branchOffice;

        const createPartnerData = (partnerIdValue, nicknameValue) => ({
            role: role,
            nickname: nicknameValue,
            partner_id: partnerIdValue,
            password: hashedPassword,
            exchange_secure_number: hashedExchangePassword,
            parent_partner_id: parentPartnerId,
            phone_number: payload.phoneNumber || '',
            bank_id: payload.bank.trim(),
            bank_number: payload.account.trim(),
            bank_owner_name: payload.name.trim(),
            simple_bet_rate: payload.dapol ? Number(payload.dapol) : null,
            combined_bet_rate: payload.danpol ? Number(payload.danpol) : null,
            match_num_bet_rate: payload.numberMatch ? Number(payload.numberMatch) : null,
            currency_rolling: payload.currencyRolling?.check || false,
            deposit_approved_amount: payload.currencyRolling?.amount ? Number(payload.currencyRolling.amount) : 0,
            partner_access_permission: payload.permissions?.partnerPageAccess || false,
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
            onetime_earning_min: payload.gameSetting?.oneTimeEarningMin ? Number(payload.gameSetting.oneTimeEarningMin) : null,
            onetime_earning_max: payload.gameSetting?.oneTimeEarningMax ? Number(payload.gameSetting.oneTimeEarningMax) : null,
            oneround_bet_max: payload.gameSetting?.oneRoundBetMax ? Number(payload.gameSetting.oneRoundBetMax) : null,
            oneround_earning_max: payload.gameSetting?.oneRoundEarningMax ? Number(payload.gameSetting.oneRoundEarningMax) : null,
            oneround_bet_max_slot: payload.gameSetting?.oneRoundBetMaxPerSlot ? Number(payload.gameSetting.oneRoundBetMaxPerSlot) : null,
            oneround_earning_max_slot: payload.gameSetting?.oneRoundEarningMaxPerSlot ? Number(payload.gameSetting.oneRoundEarningMaxPerSlot) : null,
            all_rounds_bet_max: payload.gameSetting?.allRoundsBetMax ? Number(payload.gameSetting.allRoundsBetMax) : null,
            all_rounds_bet_max_by_slots: payload.gameSetting?.allRoundsBetMaxBySlots && Array.isArray(payload.gameSetting.allRoundsBetMaxBySlots) 
                ? payload.gameSetting.allRoundsBetMaxBySlots.map(slot => ({
                    bet_type: slot.bet_type || '',
                    slot_bet_max: slot.slot_bet_max ? Number(slot.slot_bet_max) : null,
                    public: slot.public || false
                }))
                : [],
        });

        if (payload.checked === true || payload.checked === 'true') {
            if (payload.startTime === null || payload.startTime === undefined) {
                return responseBadRequest(res, t("start_number_required"));
            }
            if (payload.endTime === null || payload.endTime === undefined) {
                return responseBadRequest(res, t("end_number_required"));
            }
            const startNum = Number(payload.startTime);
            const endNum = Number(payload.endTime);
            if (isNaN(startNum) || isNaN(endNum)) {
                return responseBadRequest(res, t("invalid_number_format"));
            }
            if (endNum <= startNum) {
                return responseBadRequest(res, t("end_number_must_be_greater"));
            }

            const basePartnerId = payload.partnerId.trim();
            const baseNickname = payload.nickname.trim();
            const createdPartners = [];
            const errors = [];

            for (let i = startNum; i <= endNum; i++) {
                const numberedPartnerId = `${basePartnerId}${i}`;
                const numberedNickname = `${baseNickname}${i}`;

                if (!partnerIdRegex.test(numberedPartnerId)) {
                    errors.push(t("partner_id_invalid_format_with_value", numberedPartnerId));
                    continue;
                }
                if (!nicknameRegex.test(numberedNickname)) {
                    errors.push(t("nickname_invalid_format_with_value", numberedNickname));
                    continue;
                }

                const existingPartner = await PartnerModel.findOne({ partner_id: numberedPartnerId });
                if (existingPartner) {
                    errors.push(t("partner_id_exists_with_value", numberedPartnerId));
                    continue;
                }

                const existingPartnerByNickname = await PartnerModel.findOne({ nickname: numberedNickname });
                if (existingPartnerByNickname) {
                    errors.push(t("partner_nickname_exists_with_value", numberedNickname));
                    continue;
                }

                try {
                    await PartnerModel.create(createPartnerData(numberedPartnerId, numberedNickname));
                    createdPartners.push(i);
                } catch (error) {
                    console.error(`Error creating partner ${i}:`, error);
                    errors.push(t("failed_to_create_partner_with_value", i, error.message));
                }
            }

            if (errors.length > 0 && createdPartners.length === 0) {
                return responseBadRequest(res, errors.join('; '));
            }

            if (errors.length > 0) {
                return responseSuccess(res, {
                    created: createdPartners.length,
                    total: endNum - startNum + 1,
                    errors: errors
                }, t("successfully_created_partners_with_errors", createdPartners.length, errors.join('; ')));
            }

            return responseSuccess(res, {
                created: createdPartners.length,
                total: endNum - startNum + 1
            }, t("successfully_created_partners", createdPartners.length));
        }

        const existingPartner = await PartnerModel.findOne({ partner_id: payload.partnerId.trim() });
        if (existingPartner) {
            return responseBadRequest(res, t("partner_id_exists"));
        }

        const existingPartnerByNickname = await PartnerModel.findOne({ nickname: payload.nickname.trim() });
        if (existingPartnerByNickname) {
            return responseBadRequest(res, t("partner_nickname_exists"));
        }

        const newPartner = await PartnerModel.create(createPartnerData(payload.partnerId.trim(), payload.nickname.trim()));

        return responseSuccess(res, {
            partner: newPartner
        });
    } catch (error) {
        console.error('Error registering partner:', error);
        return responseServerError(res);
    }
};

export const checkPartnerAvailability = async (req, res) => {
    try {
        const currentPartnerId = req.session?._id;
        if (!currentPartnerId) {
            return responseUnAutherized(res);
        }

        const currentPartner = await PartnerModel.findById(currentPartnerId).lean();
        if (!currentPartner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const isHeadquater = currentPartner.role === partnerType.headquater;
        const hasPartnerAccessPermission = currentPartner.partner_access_permission === true;

        if (!isHeadquater && !hasPartnerAccessPermission) {
            return responsePermissionDenied(res);
        }

        const { type, value, excludeId } = req.body || {};

        if (!type || typeof type !== 'string') {
            return responseSuccess(res, { available: false }, t("check_type_required"));
        }

        if (!value || !value.trim()) {
            return responseSuccess(res, { available: false }, t("value_required"));
        }

        const trimmedValue = value.trim();
        let fieldName = "";
        let regex;
        let invalidKey = "";

        if (type === "partnerId") {
            fieldName = "partner_id";
            regex = /^[A-Za-z][\w\-@!]{2,9}$/;
            invalidKey = "partner_id_invalid_format";
        } else if (type === "nickname") {
            fieldName = "nickname";
            regex = /^[A-Za-z][A-Za-z0-9_-]{2,9}$/;
            invalidKey = "nickname_invalid_format";
        } else {
            return responseSuccess(res, { available: false }, t("invalid_check_type"));
        }

        if (!regex.test(trimmedValue)) {
            return responseSuccess(res, { available: false }, t(invalidKey));
        }

        const query = { [fieldName]: trimmedValue };
        if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
            query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
        }

        const existing = await PartnerModel.findOne(query);

        if (existing) {
            const messageKey = type === "partnerId" ? "partner_id_exists" : "partner_nickname_exists";
            return responseSuccess(res, { available: false }, t(messageKey));
        }

        return responseSuccess(res, { available: true }, t("available"));
    } catch (error) {
        console.error('Error checking partner availability:', error);
        return responseServerError(res);
    }
};

