import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const cancelExchange = async (req, res) => {
  try {
    const { transactionId } = req.body;
    const userId = req.session._id;

    if (!transactionId) {
      return responseBadRequest(res, t("transaction_id_required"));
    }
    const transaction = await TransactionModel.findOne({
      _id: transactionId,
      user_id: userId,
      fund_type: "EXCHANGE",
      fund_status: "PENDING",
    });

    if (!transaction) {
      return responseBadRequest(res, t("transaction_not_found_or_cannot_cancelled"));
    }

    const updateResult = await TransactionModel.updateOne(
      { _id: transactionId, user_id: userId, fund_status: "PENDING" },
      { $set: { fund_status: "REJECTED" } }
    );

    if (!updateResult.modifiedCount) {
      return responseBadRequest(res, t("failed_to_cancel_transaction"));
    }

    const refundAmount = transaction.original_amount || transaction.fund_amount || 0;
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { own_money: refundAmount } },
      { new: true, select: "own_money" }
    );

    if (!updatedUser) {
      return responseBadRequest(res, t("user_not_found"));
    }

    return responseSuccess(
      res,
      {
        transactionId: transaction._id,
        original_amount: refundAmount,
        balance: updatedUser.own_money,
      },
      t("exchange_request_cancelled")
    );
  } catch (error) {
    console.error("Error cancelling exchange request:", error);
    return responseServerError(res);
  }
};

