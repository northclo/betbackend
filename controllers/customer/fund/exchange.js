import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import SettingModel from "../../../models/Setting.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";
import mongoose from "mongoose";
import { t } from "../../../helper/translation.js";

const DEFAULT_EXCHANGE_RATES = {
    'USD_KRW': 1325,  // 1 USD = 1325 KRW
    'KRW_USD': 0.000755,  // 1 KRW = 0.000755 USD
    'USD_JPY': 150,  // 1 USD = 150 JPY
    'JPY_USD': 0.00667,  // 1 JPY = 0.00667 USD
    'KRW_JPY': 0.113,  // 1 KRW = 0.113 JPY
    'JPY_KRW': 8.85  // 1 JPY = 8.85 KRW
};

const getExchangeRate = (fromCurrency, toCurrency) => {
    const key = `${fromCurrency}_${toCurrency}`;
    return DEFAULT_EXCHANGE_RATES[key] || 1;
};

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
    const { from_currency, to_currency, original_amount, secure_code, amount } = req.body;
    const userId = req.session._id;

    const isSimpleExchange = secure_code !== undefined && secure_code !== null && secure_code !== '';
    const exchangeAmount = isSimpleExchange ? amount : original_amount;

    if (isSimpleExchange) {
        if (exchangeAmount === undefined || exchangeAmount === null || exchangeAmount === '') {
            return responseBadRequest(res, t("original_amount_required"));
        }

        const normalizedAmount = Number(exchangeAmount);
        if (isNaN(normalizedAmount) || !isFinite(normalizedAmount) || normalizedAmount <= 0) {
            return responseBadRequest(res, t("invalid_amount_positive"));
        }

        const fromCurrency = 'USD';
        const toCurrency = 'USD';
        const exchangeRate = 1;
        const convertedAmount = normalizedAmount;

        try {
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
                    } else if (settings.exchange_restriction === 'request' && lastExchange.original_amount === normalizedAmount) {
                        return responseBadRequest(res, t("same_exchange_amount_not_allowed_within_restriction_period"));
                    }
                }
            }

            if (settings.charge_restriction_use && settings.charge_restriction_limit) {
                const limitMinutes = settings.charge_restriction_limit;
                const limitTime = new Date(Date.now() - limitMinutes * 60 * 1000);
                
                const lastCharge = await TransactionModel.findOne({
                    user_id: userId,
                    fund_type: "IMPORT",
                    createdAt: { $gte: limitTime }
                }).sort({ createdAt: -1 });

                if (lastCharge) {
                    return responseBadRequest(res, t("exchange_not_available_after_recent_charge"));
                }
            }

            const user = await UserModel.findById(userId).select("own_money");
            if (!user) {
                return responseBadRequest(res, t("user_not_found"));
            }

            if (normalizedAmount > (user.own_money || 0)) {
                return responseBadRequest(res, t("insufficient_balance"));
            }

            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                const updatedUser = await UserModel.findByIdAndUpdate(
                    userId,
                    { $inc: { own_money: -normalizedAmount } },
                    { new: true, session, select: "own_money" }
                );

                if (!updatedUser) {
                    await session.abortTransaction();
                    return responseBadRequest(res, t("failed_update_user_balance"));
                }

                const transaction = await TransactionModel.create([{
                    user_id: userId,
                    fund_type: "EXCHANGE",
                    fund_status: "PENDING",
                    fund_amount: convertedAmount,
                    currency: toCurrency,
                    from_currency: fromCurrency,
                    to_currency: toCurrency,
                    exchange_rate: exchangeRate,
                    original_amount: normalizedAmount
                }], { session });

                await session.commitTransaction();

                const exchangeCompleteMessage = settings?.exchange_complete_message || t("exchange_request_submitted");
                
                return responseSuccess(
                    res,
                    {
                        transaction_id: transaction[0]._id,
                        from_currency: fromCurrency,
                        to_currency: toCurrency,
                        original_amount: normalizedAmount,
                        converted_amount: convertedAmount,
                        exchange_rate: exchangeRate,
                        balance: updatedUser.own_money,
                        status: "PENDING",
                        message: exchangeCompleteMessage
                    },
                    exchangeCompleteMessage
                );
            } catch (error) {
                await session.abortTransaction();
                throw error;
            } finally {
                session.endSession();
            }
        } catch (error) {
            console.error("Error processing exchange:", error);
            return responseBadRequest(res, t("failed_process_exchange"));
        }
    }

    if (!from_currency || !to_currency) {
        return responseBadRequest(res, t("from_to_currency_required"));
    }

    if (from_currency === to_currency) {
        return responseBadRequest(res, t("currencies_must_different"));
    }

    if (original_amount === undefined || original_amount === null || original_amount === '') {
        return responseBadRequest(res, t("original_amount_required"));
    }

    const normalizedAmount = Number(original_amount);
    if (isNaN(normalizedAmount) || !isFinite(normalizedAmount) || normalizedAmount <= 0) {
        return responseBadRequest(res, t("invalid_amount_positive"));
    }

    const fromCurrency = from_currency.toUpperCase();
    const toCurrency = to_currency.toUpperCase();

    const validCurrencies = ['USD', 'KRW', 'JPY'];
    if (!validCurrencies.includes(fromCurrency) || !validCurrencies.includes(toCurrency)) {
        return responseBadRequest(res, t("invalid_currency"));
    }

    try {
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

        // Check exchange restriction
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
                } else if (settings.exchange_restriction === 'request' && lastExchange.original_amount === normalizedAmount) {
                    return responseBadRequest(res, t("same_exchange_amount_not_allowed_within_restriction_period"));
                }
            }
        }

        // Check charge restriction
        if (settings.charge_restriction_use && settings.charge_restriction_limit) {
            const limitMinutes = settings.charge_restriction_limit;
            const limitTime = new Date(Date.now() - limitMinutes * 60 * 1000);
            
            const lastCharge = await TransactionModel.findOne({
                user_id: userId,
                fund_type: "IMPORT",
                createdAt: { $gte: limitTime }
            }).sort({ createdAt: -1 });

            if (lastCharge) {
                return responseBadRequest(res, t("exchange_not_available_after_recent_charge"));
            }
        }

        const user = await UserModel.findById(userId).select("own_money");
        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        if (normalizedAmount > (user.own_money || 0)) {
            return responseBadRequest(res, t("insufficient_balance"));
        }

        const exchangeRate = getExchangeRate(fromCurrency, toCurrency);
        const convertedAmount = Math.floor(normalizedAmount * exchangeRate * 100) / 100;

        if (convertedAmount <= 0) {
            return responseBadRequest(res, t("converted_amount_too_small"));
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const updatedUser = await UserModel.findByIdAndUpdate(
                userId,
                { $inc: { own_money: -normalizedAmount } },
                { new: true, session, select: "own_money" }
            );

            if (!updatedUser) {
                await session.abortTransaction();
                return responseBadRequest(res, t("failed_update_user_balance"));
            }

            const transaction = await TransactionModel.create([{
                user_id: userId,
                fund_type: "EXCHANGE",
                fund_status: "PENDING",
                fund_amount: convertedAmount,
                currency: toCurrency,
                from_currency: fromCurrency,
                to_currency: toCurrency,
                exchange_rate: exchangeRate,
                original_amount: normalizedAmount
            }], { session });

            await session.commitTransaction();

            return responseSuccess(
                res,
                {
                    transaction_id: transaction[0]._id,
                    from_currency: fromCurrency,
                    to_currency: toCurrency,
                    original_amount: normalizedAmount,
                    converted_amount: convertedAmount,
                    exchange_rate: exchangeRate,
                    balance: updatedUser.own_money,
                    status: "PENDING"
                },
                t("exchange_request_submitted")
            );
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error("Error processing exchange:", error);
        return responseBadRequest(res, t("failed_process_exchange"));
    }
};

