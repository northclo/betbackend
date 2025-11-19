import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { responseBadRequest, responseSuccess, responseServerError, responseUnAutherized, responsePermissionDenied } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { t } from "../../../helper/translation.js";
import { partnerType } from "../../../const/type.js";

export const registerUser = async (req, res) => {
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

        const hasUserCreationPermission = currentPartner.user_creation_permission === true;

        if (!isHeadquater && !hasUserCreationPermission) {
            return responsePermissionDenied(res);
        }

        if (!payload.nickname || !payload.nickname.trim()) {
            return responseBadRequest(res, t("nickname_required"));
        }

        const nicknameRegex = /^[a-zA-Z0-9]{2,10}$/;
        if (!nicknameRegex.test(payload.nickname.trim())) {
            return responseBadRequest(res, t("user_nickname_invalid_format"));
        }

        if (!payload.email || !payload.email.trim()) {
            return responseBadRequest(res, t("email_required"));
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(payload.email.trim())) {
            return responseBadRequest(res, t("invalid_email_format"));
        }

        if (!payload.password || !payload.password.trim()) {
            return responseBadRequest(res, t("password_required"));
        }

        if (payload.password.trim().length < 6) {
            return responseBadRequest(res, t("password_min_length_6"));
        }

        if (!payload.exchangePassword || !payload.exchangePassword.trim()) {
            return responseBadRequest(res, t("exchange_password_required"));
        }

        if (!payload.bankName || !payload.bankName.trim()) {
            return responseBadRequest(res, t("bank_required"));
        }

        if (!payload.bankNumber || !payload.bankNumber.trim()) {
            return responseBadRequest(res, t("bank_account_required"));
        }

        if (!payload.bankOwner || !payload.bankOwner.trim()) {
            return responseBadRequest(res, t("bank_owner_name_required"));
        }

        if (!payload.userName || !payload.userName.trim()) {
            return responseBadRequest(res, t("user_name_required"));
        }

        const userNameRegex = /^[a-zA-Z0-9]{4,12}$/;
        if (!userNameRegex.test(payload.userName.trim())) {
            return responseBadRequest(res, t("invalid_user_name_format"));
        }

        const existingUserByNickname = await UserModel.findOne({ user_nickname: payload.nickname.trim() });
        if (existingUserByNickname) {
            return responseBadRequest(res, t("user_nickname_exists"));
        }

        const existingUserByEmail = await UserModel.findOne({ user_email: payload.email.trim() });
        if (existingUserByEmail) {
            return responseBadRequest(res, t("user_email_already_exists"));
        }

        let partnerId = null;
        if (payload.partner) {
            const partner = await PartnerModel.findOne({ partner_id: payload.partner.trim() });
            if (!partner) {
                return responseBadRequest(res, t("partner_not_found"));
            }
            partnerId = partner._id;
        } else {
            partnerId = currentPartnerId;
        }

        if (!partnerId) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(payload.password.trim(), salt);
        const hashedExchangePassword = await bcrypt.hash(payload.exchangePassword.trim(), salt);

        await UserModel.create({
            user_nickname: payload.nickname.trim(),
            user_email: payload.email.trim(),
            password: hashedPassword,
            exchange_password: hashedExchangePassword,
            user_name: payload.userName.trim(),
            partner_id: partnerId,
            phone_number: payload.phoneNumber || '',
            bank_id: payload.bankName.trim(),
            bank_number: payload.bankNumber.trim(),
            bank_owner_name: payload.bankOwner.trim(),
            memo_note: payload.memo || '',
            simple_bet_rate: payload.simpleBetRate ? Number(payload.simpleBetRate) : null,
            combined_bet_rate: payload.combinedBetRate ? Number(payload.combinedBetRate) : null,
            match_num_bet_rate: payload.matchNumberBetRate ? Number(payload.matchNumberBetRate) : null,
        });

        return responseSuccess(res);
    } catch (error) {
        console.error('Error registering user:', error);
        return responseServerError(res);
    }
};

export const checkUserAvailability = async (req, res) => {
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

        const { type, value } = req.body || {};

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

        if (type === "email") {
            fieldName = "user_email";
            regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            invalidKey = "invalid_email_format";
        } else if (type === "nickname") {
            fieldName = "user_nickname";
            regex = /^[a-zA-Z0-9]{2,10}$/;
            invalidKey = "user_nickname_invalid_format";
        } else if (type === "userName") {
            fieldName = "user_name";
            regex = /^[a-zA-Z0-9]{4,12}$/;
            invalidKey = "invalid_user_name_format";
        } else {
            return responseSuccess(res, { available: false }, t("invalid_check_type"));
        }

        if (!regex.test(trimmedValue)) {
            return responseSuccess(res, { available: false }, t(invalidKey));
        }

        const existing = await UserModel.findOne({ [fieldName]: trimmedValue });

        if (existing) {
            if (type === "email") {
                return responseSuccess(res, { available: false }, t("user_email_already_exists"));
            } else if (type === "nickname") {
                return responseSuccess(res, { available: false }, t("user_nickname_exists"));
            } else {
                return responseSuccess(res, { available: false }, t("user_name_already_exists"));
            }
        }

        return responseSuccess(res, { available: true }, t("available"));
    } catch (error) {
        console.error('Error checking user availability:', error);
        return responseServerError(res);
    }
};