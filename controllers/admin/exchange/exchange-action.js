import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";

export const updateExchangeStatus = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const { transactionId, action } = req.body;

        if (!transactionId) {
            return responseBadRequest(res, t("transaction_id_required"));
        }

        if (!action || !['approve', 'reject'].includes(action)) {
            return responseBadRequest(res, t("invalid_action"));
        }

        const newStatus = action === 'approve' ? 'COMPLETE' : 'CANCEL';

        if (action === 'reject') {
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                const transaction = await TransactionModel.findOneAndUpdate(
                    { _id: transactionId, fund_type: 'EXCHANGE', fund_status: 'WAIT' },
                    { $set: { fund_status: newStatus, action_user_id: adminId, fund_status_update_date: new Date() } },
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
                { _id: transactionId, fund_type: 'EXCHANGE', fund_status: 'WAIT' },
                { $set: { fund_status: newStatus, action_user_id: adminId, fund_status_update_date: new Date() } },
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
        return responseServerError(res);
    }
};

