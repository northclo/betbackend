import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const updateExchangeStatus = async (req, res) => {
    const { transactionId, action } = req.body;
    const adminId = req.session._id;

    if (!transactionId) {
        return responseBadRequest(res, t("transaction_id_required"));
    }

    if (!action || !['approve', 'reject'].includes(action)) {
        return responseBadRequest(res, t("invalid_action"));
    }

    try {
        const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

        const transaction = await TransactionModel.findOneAndUpdate(
            { _id: transactionId, fund_type: 'EXCHANGE', fund_status: 'PENDING' },
            { $set: { fund_status: newStatus, processed_by: adminId, processed_at: new Date() } },
            { new: true }
        );

        if (!transaction) {
            return responseBadRequest(res, t("transaction_not_found_or_not_pending"));
        }

        const user = await UserModel.findById(transaction.user_id);
        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        if (action === 'approve') {
            await UserModel.findByIdAndUpdate(
                transaction.user_id,
                { $inc: { own_money: transaction.fund_amount } }
            );
        } else {
            const refundAmount = transaction.original_amount || transaction.fund_amount;
            await UserModel.findByIdAndUpdate(
                transaction.user_id,
                { $inc: { own_money: refundAmount } }
            );
        }

        return responseSuccess(
            res,
            {
                transactionId: transaction._id,
                status: newStatus,
                action: action
            },
            action === 'approve' ? t("exchange_transaction_approved_successfully") : t("exchange_transaction_rejected_successfully")
        );
    } catch (error) {
        console.error("Error updating exchange status:", error);
        return responseBadRequest(res, t("failed_update_exchange_status"));
    }
};

