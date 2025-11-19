import { responseBadRequest, responseSuccess, responseServerError, responseUnAutherized, responsePermissionDenied } from "../../../helper/response.js";
import SettingModel from "../../../models/Setting.js";
import PartnerModel from "../../../models/Partner.js";
import { t } from "../../../helper/translation.js";
import { partnerType } from "../../../const/type.js";

const isEmptyValue = (value) => value === undefined || value === null || value === "";

const parseNumericValue = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "") {
            return null;
        }
        const numericValue = Number(trimmed);
        return Number.isFinite(numericValue) ? numericValue : null;
    }
    return null;
};

const normalizeNumberField = (value, field, { optional = false, min, max, integer = false } = {}) => {
    if (optional && isEmptyValue(value)) {
        return { value: null };
    }

    const numericValue = parseNumericValue(value);
    if (numericValue === null) {
        return { error: t("field_must_be_valid_number", field) };
    }

    if (integer && !Number.isInteger(numericValue)) {
        return { error: t("field_must_be_integer", field) };
    }

    if (min !== undefined && numericValue < min) {
        return { error: t("field_must_be_greater_than_or_equal", field, min) };
    }

    if (max !== undefined && numericValue > max) {
        return { error: t("field_must_be_less_than_or_equal", field, max) };
    }

    return { value: numericValue };
};

const normalizeTimeField = (value, field, { required = false } = {}) => {
    if (!required && isEmptyValue(value)) {
        return { value: null };
    }

    let raw = value;
    if (typeof raw === "string" && raw.includes(":")) {
        raw = raw.replace(":", "");
    }

    const numericValue = parseNumericValue(raw);
    if (numericValue === null || !Number.isInteger(numericValue)) {
        return { error: t("field_must_be_valid_24hour_time", field) };
    }

    if (numericValue < 0 || numericValue > 2359) {
        return { error: t("field_must_be_valid_24hour_time", field) };
    }

    const minutes = numericValue % 100;
    const hours = Math.floor(numericValue / 100);

    if (hours > 23 || minutes > 59) {
        return { error: t("field_must_be_valid_24hour_time", field) };
    }

    return { value: hours * 100 + minutes };
};

const buildChargeData = (charge) => {
    const errors = [];

    if (!charge) {
        return { errors: [t("charge_settings_payload_required")], data: {} };
    }

    const timezone = Boolean(charge.chargeTimezone);
    const minResult = normalizeNumberField(charge.chargeMin, "chargeMin", { min: 0 });
    const maxResult = normalizeNumberField(charge.chargeMax, "chargeMax", { min: 0 });
    const startResult = normalizeTimeField(charge.chargeStartTime, "chargeStartTime", { required: timezone });
    const endResult = normalizeTimeField(charge.chargeEndTime, "chargeEndTime", { required: timezone });

    [minResult.error, maxResult.error, startResult.error, endResult.error]
        .filter(Boolean)
        .forEach((message) => errors.push(message));

    if (
        errors.length === 0 &&
        minResult.value !== null &&
        maxResult.value !== null &&
        minResult.value > maxResult.value
    ) {
        errors.push(t("charge_min_cannot_be_greater_than_max"));
    }

    if (
        errors.length === 0 &&
        timezone &&
        startResult.value !== null &&
        endResult.value !== null &&
        startResult.value >= endResult.value
    ) {
        errors.push(t("charge_start_time_must_be_earlier_than_end"));
    }

    return {
        errors,
        data: {
            charge_min: minResult.value,
            charge_max: maxResult.value,
            charge_timezone: timezone,
            charge_start_time: timezone ? startResult.value : null,
            charge_end_time: timezone ? endResult.value : null,
            charge_impossible_timezone_message: charge.chargeImpossibleTimezoneMessage ?? "",
            charge_complete_message: charge.chargeCompleteMessage ?? ""
        }
    };
};

const buildExchangeData = (exchange) => {
    const errors = [];

    if (!exchange) {
        return { errors: [t("exchange_settings_payload_required")], data: {} };
    }

    const timezone = Boolean(exchange.exchangeTimezone);
    const restrictionUse = Boolean(exchange.exchangeRestrictionUse);
    const chargeRestrictionUse = Boolean(exchange.chargeRestrictionUse);

    const minResult = normalizeNumberField(exchange.exchangeMin, "exchangeMin", { min: 0 });
    const maxResult = normalizeNumberField(exchange.exchangeMax, "exchangeMax", { min: 0 });
    const startResult = normalizeTimeField(exchange.exchangeStartTime, "exchangeStartTime", { required: timezone });
    const endResult = normalizeTimeField(exchange.exchangeEndTime, "exchangeEndTime", { required: timezone });
    const exchangeRestrictionLimitResult = normalizeNumberField(
        exchange.exchangeRestrictionLimit,
        "exchangeRestrictionLimit",
        { optional: !restrictionUse, min: 1, integer: true }
    );
    const chargeRestrictionLimitResult = normalizeNumberField(
        exchange.chargeRestrictionLimit,
        "chargeRestrictionLimit",
        { optional: !chargeRestrictionUse, min: 1, integer: true }
    );

    [
        minResult.error,
        maxResult.error,
        startResult.error,
        endResult.error,
        exchangeRestrictionLimitResult.error,
        chargeRestrictionLimitResult.error
    ]
        .filter(Boolean)
        .forEach((message) => errors.push(message));

    if (
        errors.length === 0 &&
        minResult.value !== null &&
        maxResult.value !== null &&
        minResult.value > maxResult.value
    ) {
        errors.push(t("exchange_min_cannot_be_greater_than_max"));
    }

    if (
        errors.length === 0 &&
        timezone &&
        startResult.value !== null &&
        endResult.value !== null &&
        startResult.value >= endResult.value
    ) {
        errors.push(t("exchange_start_time_must_be_earlier_than_end"));
    }

    return {
        errors,
        data: {
            exchange_min: minResult.value,
            exchange_max: maxResult.value,
            exchange_timezone: timezone,
            exchange_start_time: timezone ? startResult.value : null,
            exchange_end_time: timezone ? endResult.value : null,
            exchange_impossible_timezone_message: exchange.exchangeImpossibleTimezoneMessage ?? "",
            exchange_restriction: exchange.exchangeRestriction ?? "",
            exchange_restriction_use: restrictionUse,
            exchange_restriction_limit: restrictionUse ? exchangeRestrictionLimitResult.value : null,
            charge_restriction_use: chargeRestrictionUse,
            charge_restriction_limit: chargeRestrictionUse ? chargeRestrictionLimitResult.value : null,
            exchange_complete_message: exchange.exchangeCompleteMessage ?? ""
        }
    };
};

export const getSiteSetting = async (req, res) => {
    try {
        const currentPartnerId = req.session?._id;
        if (!currentPartnerId) {
            return responseUnAutherized(res);
        }

        const currentPartner = await PartnerModel.findById(currentPartnerId).lean();
        if (!currentPartner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        if (currentPartner.role !== partnerType.headquater) {
            return responsePermissionDenied(res);
        }

        const result = await SettingModel.findOneAndUpdate(
            {},
            {},
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );

        responseSuccess(res, result);
    } catch (error) {
        console.error("Error to get site setting:", error);
        return responseServerError(res);
    }
}

export const updateSiteSetting = async (req, res) => {
    try {
        const currentPartnerId = req.session?._id;
        if (!currentPartnerId) {
            return responseUnAutherized(res);
        }

        const currentPartner = await PartnerModel.findById(currentPartnerId).lean();
        if (!currentPartner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        if (currentPartner.role !== partnerType.headquater) {
            return responsePermissionDenied(res);
        }

        const {
            siteActivation,
            security,
            siteText,
            membership,
            charge,
            exchange,
            customerCenter,
            depositBanks
        } = req.body;

        if (charge === undefined || exchange === undefined) {
            return responseBadRequest(res, t("charge_and_exchange_settings_required"));
        }

        const chargeValidation = buildChargeData(charge);
        const exchangeValidation = buildExchangeData(exchange);
        const validationErrors = [...chargeValidation.errors, ...exchangeValidation.errors];

        if (validationErrors.length) {
            return responseBadRequest(res, validationErrors.join(" "));
        }

        const sanitizedCharge = chargeValidation.data;
        const sanitizedExchange = exchangeValidation.data;

        const data = {
            site_activation: siteActivation?.siteActivation ?? true,
            disable_style: siteActivation?.disableStyle ?? 'simple_text',
            deactive_message: siteActivation?.deactiveMessage ?? '',
            security: security ?? true,
            site_name: siteText?.siteName ?? '',
            title_bar: siteText?.titleBar ?? '',
            copywriter: siteText?.copywriter ?? '',
            top_notify_message: siteText?.topNotifyMessage ?? '',
            deposit_account: siteText?.depositAccount ?? '',
            membership_registration: membership?.membershipRegistration ?? 'recommender',
            membership_approval: membership?.membershipApproval ?? true,
            membership_signup_message: membership?.membershipSignupMessage ?? '',
            charge_min: sanitizedCharge.charge_min,
            charge_max: sanitizedCharge.charge_max,
            charge_timezone: sanitizedCharge.charge_timezone,
            charge_start_time: sanitizedCharge.charge_start_time,
            charge_end_time: sanitizedCharge.charge_end_time,
            charge_impossible_timezone_message: sanitizedCharge.charge_impossible_timezone_message,
            charge_complete_message: sanitizedCharge.charge_complete_message,
            exchange_min: sanitizedExchange.exchange_min,
            exchange_max: sanitizedExchange.exchange_max,
            exchange_timezone: sanitizedExchange.exchange_timezone,
            exchange_start_time: sanitizedExchange.exchange_start_time,
            exchange_end_time: sanitizedExchange.exchange_end_time,
            exchange_impossible_timezone_message: sanitizedExchange.exchange_impossible_timezone_message,
            exchange_restriction: sanitizedExchange.exchange_restriction,
            exchange_restriction_use: sanitizedExchange.exchange_restriction_use,
            exchange_restriction_limit: sanitizedExchange.exchange_restriction_limit,
            charge_restriction_use: sanitizedExchange.charge_restriction_use,
            charge_restriction_limit: sanitizedExchange.charge_restriction_limit,
            exchange_complete_message: sanitizedExchange.exchange_complete_message,
            customer_center: customerCenter !== undefined ? Boolean(customerCenter) : true,
            deposit_banks: Array.isArray(depositBanks?.depositBanks) 
                ? depositBanks.depositBanks.filter(bank => bank && typeof bank === 'string' && bank.trim() !== '')
                : []
        };

        await SettingModel.findOneAndUpdate(
            {},
            { $set: data },
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );

        responseSuccess(res);
    } catch (error) {
        console.error("Error to update site setting:", error);
        return responseServerError(res);
    }
}