import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";

export const updateExchangeStatus = async (req, res) => {
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

        if (transaction.fund_type !== 'EXCHANGE') {
            return responseBadRequest(res, "Transaction is not an exchange transaction");
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

        // Update user balance based on action
        // Note: Exchange logic depends on currency conversion details
        // For now, we'll implement a basic structure
        // This may need adjustment based on how exchange amounts are calculated
        if (action === 'approve') {
            // Exchange approval: Process the currency exchange
            // The exact logic depends on from_currency, to_currency, and exchange_rate
            // For now, we'll assume the fund_amount represents the converted amount
            // and the original amount was already deducted when the request was made
            // This might need to be adjusted based on actual exchange implementation
            await UserModel.findByIdAndUpdate(
                transaction.user_id,
                {
                    $inc: {
                        // Add the exchanged amount (converted currency)
                        // Note: This is a placeholder - actual logic depends on currency conversion
                        own_money: transaction.fund_amount
                    }
                }
            );
        } else {
            // Reject action: Refund the original amount
            // The original amount should be refunded to the user
            // This might need adjustment based on how exchange requests are created
            await UserModel.findByIdAndUpdate(
                transaction.user_id,
                {
                    $inc: {
                        // Refund the original amount
                        // Note: This is a placeholder - actual logic depends on currency conversion
                        own_money: transaction.fund_amount
                    }
                }
            );
        }

        return responseSuccess(
            res,
            {
                transactionId: transaction._id,
                status: newStatus,
                action: action
            },
            `Exchange transaction ${action === 'approve' ? 'approved' : 'rejected'} successfully`
        );
    } catch (error) {
        console.error("Error updating exchange status:", error);
        return responseBadRequest(res, "Failed to update exchange transaction status");
    }
};

