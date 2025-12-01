import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import SettingModel from "../../../models/Setting.js";
import PartnerModel from "../../../models/Partner.js";
import BettingResultModel from "../../../models/BettingResult.js";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import bcrypt from "bcrypt";
import { getAllParentPartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

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
        return responseBadRequest(res, t("fund_amount_required"));
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
        let partnerId = null;
        let user = await UserModel.findById(userId).select("own_money exchange_secure_number bank_number partner_id ownpartner_id");
        if (!user) {
            user = await PartnerModel.findById(userId).select("own_money exchange_secure_number bank_number parent_partner_id");
            if (!user) {
                return responseBadRequest(res, t("user_not_found"));
            }
            partnerId = user._id;
        } else {
            partnerId = user.partner_id || user.ownpartner_id;
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

        if (partnerId) {
            const partner = await PartnerModel.findById(partnerId).select("currency_rolling rollover_percentage").lean();
            if (partner && partner.currency_rolling && partner.rollover_percentage > 0) {
                const lastDeposit = await TransactionModel.findOne({
                    user_id: userId,
                    fund_type: "CHARGE",
                    fund_status: "COMPLETE"
                }).sort({ fund_status_update_date: -1, createdAt: -1 }).lean();

                if (lastDeposit && lastDeposit.fund_amount > 0) {
                    const depositDate = lastDeposit.fund_status_update_date || lastDeposit.createdAt;
                    const requiredBettingAmount = (lastDeposit.fund_amount * partner.rollover_percentage) / 100;

                    const totalBettingResult = await BettingResultModel.aggregate([
                        {
                            $match: {
                                user_id: userId,
                                betting_status: { $ne: "CANCEL" },
                                createdAt: { $gte: depositDate }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                total_betting: { $sum: "$bet_amount" }
                            }
                        }
                    ]);

                    const totalBettingAmount = totalBettingResult.length > 0 ? totalBettingResult[0].total_betting : 0;

                    if (totalBettingAmount < requiredBettingAmount) {
                        const percentage = partner.rollover_percentage;
                        const message = t("withdrawal_not_allowed_insufficient_betting")?.replace("{0}", percentage.toString()) || 
                            `Withdrawal is not allowed. You must bet at least ${percentage}% of your last deposit (${requiredBettingAmount.toFixed(2)}). Current betting: ${totalBettingAmount.toFixed(2)}`;
                        return responseBadRequest(res, message);
                    }
                }
            }
        }

        let updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            { $inc: { own_money: -normalizedAmount } },
            { new: true, select: "own_money" }
        );
        if (!updatedUser) {
            updatedUser = await PartnerModel.findByIdAndUpdate(
                userId,
                { $inc: { own_money: -normalizedAmount } },
                { new: true, select: "own_money" }
            );

            if (!updatedUser) {
                return responseBadRequest(res, t("failed_update_user_balance"));
            }
        }

        const transaction = await TransactionModel.create({
            user_id: userId,
            fund_type: "EXCHANGE",
            fund_status: "NEW",
            fund_amount: normalizedAmount,
            request_send_date: new Date()
        });

        try {
            const io = req.app.get("io");
            if (io) {
                const parentPartnerIds = await getAllParentPartnerIds(userId);

                io.emit("new_exchange_request", {
                    parentPartnerIds: parentPartnerIds,
                });
            }
        } catch (socketError) {
            console.error("Error emitting socket event:", socketError);
        }

        const exchangeCompleteMessage = settings?.exchange_complete_message || t("exchange_request_submitted");
        
        return responseSuccess(
            res,
            {
                transaction_id: transaction._id,
                amount: normalizedAmount,
                balance: updatedUser.own_money,
                status: "NEW",
                message: exchangeCompleteMessage
            },
            exchangeCompleteMessage
        );
    } catch (error) {
        console.error("Error processing exchange:", error);
        return responseServerError(res);
    }
};
