import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";

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

        if (action === 'reject') {
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                const transaction = await TransactionModel.findOneAndUpdate(
                    { _id: transactionId, fund_type: 'EXCHANGE', fund_status: 'PENDING' },
                    { $set: { fund_status: newStatus, processed_by: adminId, processed_at: new Date() } },
                    { new: true, session }
                );

                if (!transaction) {
                    await session.abortTransaction();
                    return responseBadRequest(res, t("transaction_not_found_or_not_pending"));
                }

                const user = await UserModel.findById(transaction.user_id).session(session);
                if (!user) {
                    await session.abortTransaction();
                    return responseBadRequest(res, t("user_not_found"));
                }

                const refundAmount = transaction.original_amount || transaction.fund_amount;
                await UserModel.findByIdAndUpdate(
                    transaction.user_id,
                    { $inc: { own_money: refundAmount } },
                    { session }
                );

                await session.commitTransaction();

                return responseSuccess(
                    res,
                    {
                        transactionId: transaction._id,
                        status: newStatus,
                        action: action
                    },
                    t("exchange_transaction_rejected_successfully")
                );
            } catch (error) {
                await session.abortTransaction();
                throw error;
            } finally {
                session.endSession();
            }
        } else {
            const transaction = await TransactionModel.findOneAndUpdate(
                { _id: transactionId, fund_type: 'EXCHANGE', fund_status: 'PENDING' },
                { $set: { fund_status: newStatus, processed_by: adminId, processed_at: new Date() } },
                { new: true }
            );

            if (!transaction) {
                return responseBadRequest(res, t("transaction_not_found_or_not_pending"));
            }

            return responseSuccess(
                res,
                {
                    transactionId: transaction._id,
                    status: newStatus,
                    action: action
                },
                t("exchange_transaction_approved_successfully")
            );
        }
    } catch (error) {
        console.error("Error updating exchange status:", error);
        return responseBadRequest(res, t("failed_update_exchange_status"));
    }
};

