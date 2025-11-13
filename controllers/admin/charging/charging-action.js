import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";

export const updateChargingStatus = async (req, res) => {
    const { transactionId, action } = req.body;
    const adminId = req.session._id;

    if (!transactionId) {
        return responseBadRequest(res, "Transaction ID is required");
    }

    if (!action || !['approve', 'reject'].includes(action)) {
        return responseBadRequest(res, "Invalid action. Must be 'approve' or 'reject'");
    }

    try {
        const transaction = await TransactionModel.findById(transactionId);

        if (!transaction) {
            return responseBadRequest(res, "Transaction not found");
        }

        if (transaction.fund_status !== 'PENDING') {
            return responseBadRequest(res, "Transaction is not pending");
        }

        const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
        const user = await UserModel.findById(transaction.user_id);

        if (!user) {
            return responseBadRequest(res, "User not found");
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
            `Transaction ${action === 'approve' ? 'approved' : 'rejected'} successfully`
        );
    } catch (error) {
        console.error("Error updating charging status:", error);
        return responseBadRequest(res, "Failed to update transaction status");
    }
};

