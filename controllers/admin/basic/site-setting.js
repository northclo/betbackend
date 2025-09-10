import isEmpty from "is-empty";
import { responseSuccess } from "../../../helper/response.js";
import SettingModel from "../../../models/Setting.js";

export const getSiteSetting = async (req, res) => {
    const siteSetting = await SettingModel.find();

    let result;
    if (isEmpty(siteSetting)) {
        result = await SettingModel.create({})
    } else {
        result = siteSetting;
    }
    responseSuccess(res, result);
}

export const updateSiteSetting = async (req, res) => {
    const {
        siteActivation,
        security,
        siteText,
        membership,
        charge,
        exchange,
        customerCenter
    } = req.body;

    const data = {
        site_activation: siteActivation.siteActivation,
        disable_style: siteActivation.disableStyle,
        deactive_message: siteActivation.deactiveMessage,
        security: security,
        site_name: siteText.siteName,
        title_bar: siteText.titleBar,
        copywriter: siteText.copywriter,
        top_notify_message: siteText.topNotifyMessage,
        deposit_account: siteText.depositAccount,
        membership_registration: membership.membershipRegistration,
        membership_approval: membership.membershipApproval,
        membership_signup_message: membership.membershipSignupMessage,
        charge_min: charge.chargeMin,
        charge_max: charge.chargeMax,
        charge_timezone: charge.chargeTimezone,
        charge_start_time: charge.chargeStartTime,
        charge_end_time: charge.chargeEndTime,
        charge_impossible_timezone_message: charge.chargeImpossibleTimezoneMessage,
        charge_complete_message: charge.chargeCompleteMessage,
        exchange_min: exchange.exchangeMin,
        exchange_max: exchange.exchangeMax,
        exchange_timezone: exchange.exchangeTimezone,
        exchange_start_time: exchange.exchangeStartTime,
        exchange_end_time: exchange.exchangeEndTime,
        exchange_impossible_timezone_message: exchange.exchangeImpossibleTimezoneMessage,
        exchange_restriction: exchange.exchangeRestriction,
        exchange_restriction_use: exchange.exchangeRestrictionUse,
        exchange_restriction_limit: exchange.exchangeRestrictionLimit,
        charge_restriction_use: exchange.chargeRestrictionUse,
        charge_restriction_limit: exchange.chargeRestrictionLimit,
        exchange_complete_message: exchange.exchangeCompleteMessage,
        customer_center: customerCenter
    }

    const siteSetting = await SettingModel.find();
    if (isEmpty(siteSetting)) {
        await SettingModel.create(data);
        responseSuccess(res)
    } else {
        await SettingModel.updateOne({ _id: siteSetting[0]._id }, data);
        responseSuccess(res)
    }
}