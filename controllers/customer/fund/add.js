import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import SettingModel from "../../../models/Setting.js";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

const isWithinTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) return true;
  
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = currentHours * 100 + currentMinutes;
  
  const start = Number(startTime);
  const end = Number(endTime);
  
  if (start > end) {
    return currentTime >= start || currentTime <= end;
  }
  
  return currentTime >= start && currentTime <= end;
};

export const addFund = async (req, res) => {
  try {
    const { amount, bank_number } = req.body;
    const userId = req.session._id;

    if (amount === undefined || amount === null || amount === '') {
      return responseBadRequest(res, t("amount_required"));
    }

    const normalizedAmount = Number(amount);
    if (isNaN(normalizedAmount) || !isFinite(normalizedAmount)) {
      return responseBadRequest(res, t("invalid_amount_number"));
    }

    if (!bank_number || !bank_number.trim()) {
      return responseBadRequest(res, t("bank_number_required"));
    }

    const setting = await SettingModel.findOne().lean();
    
    if (setting) {
      if (setting.charge_min !== null && setting.charge_min !== undefined) {
        if (normalizedAmount < setting.charge_min) {
          return responseBadRequest(res, `${t("minimum_amount")} ${setting.charge_min}`);
        }
      } else {
        if (normalizedAmount < 1) {
          return responseBadRequest(res, `${t("minimum_amount")} 1`);
        }
      }
      
      if (setting.charge_max !== null && setting.charge_max !== undefined) {
        if (normalizedAmount > setting.charge_max) {
          return responseBadRequest(res, `${t("maximum_amount")} ${setting.charge_max}`);
        }
      } else {
        if (normalizedAmount > 10000000) {
          return responseBadRequest(res, `${t("maximum_amount")} 10,000,000`);
        }
      }
      
      if (setting.charge_timezone) {
        if (!isWithinTimeRange(setting.charge_start_time, setting.charge_end_time)) {
          const message = setting.charge_impossible_timezone_message || t("charging_not_available_at_this_time");
          return responseBadRequest(res, message);
        }
      }
    } else {
      if (normalizedAmount < 1) {
        return responseBadRequest(res, `${t("minimum_amount")} 1`);
      }
      if (normalizedAmount > 10000000) {
        return responseBadRequest(res, `${t("maximum_amount")} 10,000,000`);
      }
    }
    const user = await UserModel.findById(userId).select("own_money bank_number");

    if (!user) {
      return responseBadRequest(res, t("user_not_found"));
    }

    if (!user.bank_number || user.bank_number.trim() !== bank_number.trim()) {
      return responseBadRequest(res, t("bank_number_mismatch"));
    }

    await TransactionModel.create({
      user_id: userId,
      fund_type: "CHARGE",
      fund_status: "WAIT",
      fund_amount: normalizedAmount,
      request_send_date: new Date()
    });

    const chargeCompleteMessage = setting?.charge_complete_message || t("fund_request_submitted");
    
    return responseSuccess(
      res,
      {
        amount: normalizedAmount,
        balance: user.own_money,
        status: "WAIT",
        message: chargeCompleteMessage,
      },
      chargeCompleteMessage
    );
  } catch (error) {
    console.error("Error adding fund:", error);
    return responseServerError(res);
  }
};

