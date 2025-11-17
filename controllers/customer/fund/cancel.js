import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";

export const cancelFund = async (req, res) => {
  const { transactionId } = req.body;
  const userId = req.session._id;

  if (!transactionId) {
    return responseBadRequest(res, t("transaction_id_required"));
  }

  try {
    const transaction = await TransactionModel.findOne({
      _id: transactionId,
      user_id: userId,
      fund_type: "IMPORT",
      fund_status: "PENDING",
    });

    if (!transaction) {
      return responseBadRequest(res, t("transaction_not_found_or_cannot_cancelled"));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updateResult = await TransactionModel.updateOne(
        { _id: transactionId, user_id: userId, fund_status: "PENDING" },
        { $set: { fund_status: "REJECTED" } },
        { session }
      );

      if (!updateResult.modifiedCount) {
        await session.abortTransaction();
        return responseBadRequest(res, t("failed_to_cancel_transaction"));
      }

      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { $inc: { pending_addfund_balance: -transaction.fund_amount } },
        { new: true, select: "own_money pending_addfund_balance", session }
      );

      if (!updatedUser) {
        await session.abortTransaction();
        return responseBadRequest(res, t("user_not_found"));
      }

      await session.commitTransaction();

      return responseSuccess(
        res,
        {
          transactionId: transaction._id,
          amount: transaction.fund_amount,
          balance: updatedUser.own_money,
          pending_addfund_balance: updatedUser.pending_addfund_balance || 0,
        },
        t("fund_request_cancelled")
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Error cancelling fund request:", error);
    return responseBadRequest(res, t("failed_to_cancel_fund_request"));
  }
};

