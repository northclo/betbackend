import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const updateChargingStatus = async (req, res) => {
    const { transactionId, action } = req.body;
    const adminId = req.session._id;

    if (!transactionId) {
        return responseBadRequest(res, t("transaction_id_required"));
    }

    if (!action || !['approve', 'reject'].includes(action)) {
        return responseBadRequest(res, t("invalid_action"));
    }

    try {
        const transaction = await TransactionModel.findById(transactionId);

        if (!transaction) {
            return responseBadRequest(res, t("transaction_not_found"));
        }

        if (transaction.fund_status !== 'PENDING') {
            return responseBadRequest(res, t("transaction_not_pending"));
        }

        if (transaction.fund_type !== 'IMPORT') {
            return responseBadRequest(res, t("only_import_transactions"));
        }

        const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
        const user = await UserModel.findById(transaction.user_id);

        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        // Update transaction status
        transaction.fund_status = newStatus;
        transaction.processed_by = adminId;
        transaction.processed_at = new Date();
        await transaction.save();

        // Update user balance based on action and fund type
        if (action === 'approve') {
            if (transaction.fund_type === 'IMPORT') {
                // Deposit approval: Add to own_money, subtract from pending_addfund_balance
                await UserModel.findByIdAndUpdate(
                    transaction.user_id,
                    {
                        $inc: {
                            own_money: transaction.fund_amount,
                            pending_addfund_balance: -transaction.fund_amount
                        }
                    }
                );
            } else if (transaction.fund_type === 'OUTGOING') {
                // Withdrawal approval: Money was already deducted when request was made
                // Just subtract from pending_refund_balance (don't add back to own_money)
                await UserModel.findByIdAndUpdate(
                    transaction.user_id,
                    {
                        $inc: {
                            pending_refund_balance: -transaction.fund_amount
                        }
                    }
                );
            }
        } else {
            // Reject action
            if (transaction.fund_type === 'IMPORT') {
                // Deposit rejection: Just subtract from pending_addfund_balance (no money was added yet)
                await UserModel.findByIdAndUpdate(
                    transaction.user_id,
                    {
                        $inc: {
                            pending_addfund_balance: -transaction.fund_amount
                        }
                    }
                );
            } else if (transaction.fund_type === 'OUTGOING') {
                // Withdrawal rejection: Refund to own_money, subtract from pending_refund_balance
                // (Money was deducted when request was made, so we need to refund it)
                await UserModel.findByIdAndUpdate(
                    transaction.user_id,
                    {
                        $inc: {
                            own_money: transaction.fund_amount,
                            pending_refund_balance: -transaction.fund_amount
                        }
                    }
                );
            }
        }

        return responseSuccess(
            res,
            {
                transactionId: transaction._id,
                status: newStatus,
                action: action
            },
            action === 'approve' ? t("transaction_approved_successfully") : t("transaction_rejected_successfully")
        );
    } catch (error) {
        console.error("Error updating charging status:", error);
        return responseBadRequest(res, t("failed_update_transaction_status"));
    }
};

