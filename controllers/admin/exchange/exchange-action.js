import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseSuccess, responseBadRequest, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const updateExchangeStatus = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        const { transactionId, action } = req.body;

        if (!transactionId) {
            return responseBadRequest(res, t("transaction_id_required"));
        }

        if (!action || !['approve', 'reject'].includes(action)) {
            return responseBadRequest(res, t("invalid_action"));
        }

        const transaction = await TransactionModel.findById(transactionId);

        if (!transaction) {
            return responseBadRequest(res, t("transaction_not_found_or_not_pending"));
        }

        if (transaction.fund_type !== 'EXCHANGE') {
            return responseBadRequest(res, t("only_exchange_transactions"));
        }

        if (transaction.fund_status !== 'WAIT') {
            return responseBadRequest(res, t("transaction_not_pending"));
        }

        const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];
        if (!allAccessibleIds.some(aid => aid.toString() === transaction.user_id.toString())) {
            return responseBadRequest(res, t("transaction_not_found_or_not_pending"));
        }

        const newStatus = action === 'approve' ? 'COMPLETE' : 'CANCEL';

        const updatedTransaction = await TransactionModel.findOneAndUpdate(
            { _id: transactionId, fund_type: 'EXCHANGE', fund_status: 'WAIT' },
            { $set: { fund_status: newStatus, action_user_id: adminId, fund_status_update_date: new Date() } },
            { new: true }
        );

        if (!updatedTransaction) {
            return responseBadRequest(res, t("transaction_not_found_or_not_pending"));
        }

        if (action === 'reject') {
            try {
                const refundAmount = -updatedTransaction.fund_amount;
                let updatedUser = await UserModel.findByIdAndUpdate(
                    updatedTransaction.user_id,
                    { $inc: { own_money: refundAmount } },
                    { new: true }
                );
                
                if (!updatedUser) {
                    await PartnerModel.findByIdAndUpdate(
                        updatedTransaction.user_id,
                        { $inc: { own_money: refundAmount } }
                    );
                }
            } catch (refundError) {
                console.error("Error refunding money:", refundError);
            }
        }

        return responseSuccess(
            res,
            {
                transactionId: updatedTransaction._id,
                status: newStatus,
                action: action
            },
            action === 'approve' ? t("exchange_transaction_approved_successfully") : t("exchange_transaction_rejected_successfully")
        );
    } catch (error) {
        console.error("Error updating exchange status:", error);
        return responseServerError(res);
    }
};

