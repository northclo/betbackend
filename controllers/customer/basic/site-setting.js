import isEmpty from "is-empty";
import { responseSuccess, responseServerError } from "../../../helper/response.js";
import SettingModel from "../../../models/Setting.js";
import BankAccountModel from "../../../models/BankAccount.js";

export const getSiteSetting = async (req, res) => {
  try {
    const siteSetting = await SettingModel.findOne().lean();

    const bankAccounts = await BankAccountModel.find({})
      .select('bank_name')
      .sort({ bank_name: 1 })
      .lean();

    const bankAccountInfos = bankAccounts.map(account => account.bank_name);

    let result;
    if (isEmpty(siteSetting)) {
      result = {
        site_activation: true,
        disable_style: 'simple_text',
        deactive_message: '',
        security: true,
        site_name: '',
        title_bar: '',
        copywriter: '',
        top_notify_message: '',
        deposit_account_information: '',
        membership_registration: 'recommender',
        membership_approval: true,
        membership_signup_message: '',
        charge_min: null,
        charge_max: null,
        charge_timezone: false,
        charge_start_time: null,
        charge_end_time: null,
        charge_impossible_timezone_message: '',
        charge_complete_message: '',
        exchange_min: null,
        exchange_max: null,
        exchange_timezone: false,
        exchange_start_time: null,
        exchange_end_time: null,
        exchange_impossible_timezone_message: '',
        exchange_restriction: 'impossible',
        exchange_restriction_use: false,
        exchange_restriction_limit: null,
        charge_restriction_use: false,
        charge_restriction_limit: null,
        exchange_complete_message: '',
        customer_center: true,
        bank_accounts: bankAccountInfos || [],
      };
    } else {
      result = {
        site_activation: siteSetting.site_activation,
        disable_style: siteSetting.disable_style,
        deactive_message: siteSetting.deactive_message || '',
        security: siteSetting.security,
        site_name: siteSetting.site_name || '',
        title_bar: siteSetting.title_bar || '',
        copywriter: siteSetting.copywriter || '',
        top_notify_message: siteSetting.top_notify_message || '',
        deposit_account_information: siteSetting.deposit_account_information || '',
        membership_registration: siteSetting.membership_registration,
        membership_approval: siteSetting.membership_approval,
        membership_signup_message: siteSetting.membership_signup_message || '',
        charge_min: siteSetting.charge_min ?? null,
        charge_max: siteSetting.charge_max ?? null,
        charge_timezone: siteSetting.charge_timezone ?? false,
        charge_start_time: siteSetting.charge_start_time ?? null,
        charge_end_time: siteSetting.charge_end_time ?? null,
        charge_impossible_timezone_message: siteSetting.charge_impossible_timezone_message || '',
        charge_complete_message: siteSetting.charge_complete_message || '',
        exchange_min: siteSetting.exchange_min ?? null,
        exchange_max: siteSetting.exchange_max ?? null,
        exchange_timezone: siteSetting.exchange_timezone ?? false,
        exchange_start_time: siteSetting.exchange_start_time ?? null,
        exchange_end_time: siteSetting.exchange_end_time ?? null,
        exchange_impossible_timezone_message: siteSetting.exchange_impossible_timezone_message || '',
        exchange_restriction: siteSetting.exchange_restriction ?? 'impossible',
        exchange_restriction_use: siteSetting.exchange_restriction_use ?? false,
        exchange_restriction_limit: siteSetting.exchange_restriction_limit ?? null,
        charge_restriction_use: siteSetting.charge_restriction_use ?? false,
        charge_restriction_limit: siteSetting.charge_restriction_limit ?? null,
        exchange_complete_message: siteSetting.exchange_complete_message || '',
        customer_center: siteSetting.customer_center ?? true,
        bank_accounts: bankAccountInfos || [],
      };
    }
    
    return responseSuccess(res, result);
  } catch (error) {
    console.error("Error fetching site setting:", error);
    return responseServerError(res);
  }
};

