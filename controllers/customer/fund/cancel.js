import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const cancelFund = async (req, res) => {
  try {
    const { transactionId } = req.body;
    const userId = req.session._id;

    if (!transactionId) {
      return responseBadRequest(res, t("transaction_id_required"));
    }
    const transaction = await TransactionModel.findOne({
      _id: transactionId,
      user_id: userId,
      fund_type: "CHARGE",
      fund_status: { $in: ["NEW", "WAIT"] },
    });

    if (!transaction) {
      return responseBadRequest(res, t("transaction_not_found_or_cannot_cancelled"));
    }

    const updateResult = await TransactionModel.updateOne(
      { _id: transactionId, user_id: userId, fund_status: { $in: ["NEW", "WAIT"] } },
      { $set: { fund_status: "CANCEL", fund_status_update_date: new Date() } }
    );

    if (!updateResult.modifiedCount) {
      return responseBadRequest(res, t("failed_to_cancel_transaction"));
    }

    let user = await UserModel.findById(userId).select("own_money");
    if (!user) {
      user = await PartnerModel.findById(userId).select("own_money");
      if (!user) {
        return responseBadRequest(res, t("user_not_found"));
      }
    }

    return responseSuccess(
      res,
      {
        transactionId: transaction._id,
        amount: transaction.fund_amount,
        balance: user.own_money,
      },
      t("fund_request_cancelled")
    );
  } catch (error) {
    console.error("Error cancelling fund request:", error);
    return responseServerError(res);
  }
};

