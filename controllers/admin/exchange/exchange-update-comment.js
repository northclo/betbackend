import TransactionModel from "../../../models/TransactionHistory.js";
import {
  responseBadRequest,
  responseSuccess,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const updateExchangeComment = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

    const { transactionId } = req.params;
    const { comment } = req.body;

    if (!transactionId) {
      return responseBadRequest(res, t("transaction_id_required"));
    }

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return responseBadRequest(res, t("invalid_transaction_id"));
    }

    const transaction = await TransactionModel.findOne({
      _id: transactionId,
      fund_type: 'EXCHANGE'
    });

    if (!transaction) {
      return responseBadRequest(res, t("transaction_not_found"));
    }

    if (!accessibleUserIds.some(aid => aid.toString() === transaction.user_id.toString())) {
      return responseBadRequest(res, t("transaction_not_found"));
    }

    transaction.comment = comment !== undefined ? (comment || null) : transaction.comment;
    await transaction.save();

    return responseSuccess(
      res,
      {
        transactionId: transaction._id.toString(),
        comment: transaction.comment
      },
      t("comment_updated_successfully")
    );
  } catch (error) {
    console.error("Error updating exchange comment:", error);
    return responseServerError(res);
  }
};

