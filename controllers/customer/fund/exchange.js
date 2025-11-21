import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import SettingModel from "../../../models/Setting.js";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import bcrypt from "bcrypt";

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

export const exchangeFund = async (req, res) => {
    try {
    const { amount, secure_code, bank_number } = req.body;
    const userId = req.session._id;

    if (amount === undefined || amount === null || amount === '') {
        return responseBadRequest(res, t("original_amount_required"));
    }

    const normalizedAmount = Number(amount);
    if (isNaN(normalizedAmount) || !isFinite(normalizedAmount) || normalizedAmount <= 0) {
        return responseBadRequest(res, t("invalid_amount_positive"));
    }

    if (!secure_code || !secure_code.trim()) {
        return responseBadRequest(res, t("exchange_password_required"));
    }

    if (!bank_number || !bank_number.trim()) {
        return responseBadRequest(res, t("bank_number_required"));
    }
        const settings = await SettingModel.findOne();
        if (!settings) {
            return responseBadRequest(res, t("system_settings_not_found"));
        }

        if (settings.exchange_min && normalizedAmount < settings.exchange_min) {
            return responseBadRequest(res, `${t("minimum_exchange_amount")} ${settings.exchange_min}`);
        }
        if (settings.exchange_max && normalizedAmount > settings.exchange_max) {
            return responseBadRequest(res, `${t("maximum_exchange_amount")} ${settings.exchange_max}`);
        }

        if (settings.exchange_timezone) {
            if (!isWithinTimeRange(settings.exchange_start_time, settings.exchange_end_time)) {
                const message = settings.exchange_impossible_timezone_message || t("exchange_not_available");
                return responseBadRequest(res, message);
            }
        }

        if (settings.exchange_restriction_use && settings.exchange_restriction_limit) {
            const limitMinutes = settings.exchange_restriction_limit;
            const limitTime = new Date(Date.now() - limitMinutes * 60 * 1000);
            
            const lastExchange = await TransactionModel.findOne({
                user_id: userId,
                fund_type: "EXCHANGE",
                createdAt: { $gte: limitTime }
            }).sort({ createdAt: -1 });

            if (lastExchange) {
                if (settings.exchange_restriction === 'impossible') {
                    return responseBadRequest(res, t("exchange_not_available_within_restriction_period"));
                } else if (settings.exchange_restriction === 'request' && lastExchange.fund_amount === normalizedAmount) {
                    return responseBadRequest(res, t("same_exchange_amount_not_allowed_within_restriction_period"));
                }
            }
        }

        if (settings.charge_restriction_use && settings.charge_restriction_limit) {
            const limitMinutes = settings.charge_restriction_limit;
            const limitTime = new Date(Date.now() - limitMinutes * 60 * 1000);
            
            const lastCharge = await TransactionModel.findOne({
                user_id: userId,
                fund_type: "CHARGE",
                createdAt: { $gte: limitTime }
            }).sort({ createdAt: -1 });

            if (lastCharge) {
                return responseBadRequest(res, t("exchange_not_available_after_recent_charge"));
            }
        }

        const user = await UserModel.findById(userId).select("own_money exchange_secure_number bank_number");
        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        if (!user.exchange_secure_number) {
            return responseBadRequest(res, t("exchange_password_not_set"));
        }

        if (!secure_code || !secure_code.trim()) {
            return responseBadRequest(res, t("exchange_password_required"));
        }

        const isSecureCodeMatch = await bcrypt.compare(secure_code.trim(), user.exchange_secure_number);
        if (!isSecureCodeMatch) {
            return responseBadRequest(res, t("exchange_password_incorrect"));
        }

        if (!user.bank_number || user.bank_number.trim() !== bank_number.trim()) {
            return responseBadRequest(res, t("bank_number_mismatch"));
        }

        if (normalizedAmount > (user.own_money || 0)) {
            return responseBadRequest(res, t("insufficient_balance"));
        }

        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            { $inc: { own_money: -normalizedAmount } },
            { new: true, select: "own_money" }
        );

        if (!updatedUser) {
            return responseBadRequest(res, t("failed_update_user_balance"));
        }

        const transaction = await TransactionModel.create({
            user_id: userId,
            fund_type: "EXCHANGE",
            fund_status: "WAIT",
            fund_amount: normalizedAmount,
            request_send_date: new Date()
        });

        const exchangeCompleteMessage = settings?.exchange_complete_message || t("exchange_request_submitted");
        
        return responseSuccess(
            res,
            {
                transaction_id: transaction._id,
                amount: normalizedAmount,
                balance: updatedUser.own_money,
                status: "WAIT",
                message: exchangeCompleteMessage
            },
            exchangeCompleteMessage
        );
    } catch (error) {
        console.error("Error processing exchange:", error);
        return responseServerError(res);
    }
};
