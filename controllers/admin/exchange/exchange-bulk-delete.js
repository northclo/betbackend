import mongoose from "mongoose";
import TransactionModel from "../../../models/TransactionHistory.js";
import {
  responseBadRequest,
  responseSuccess,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const bulkDeleteExchangeTransactions = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return responseBadRequest(res, t("transaction_ids_required"));
    }

    const validIds = ids
      .map(id => {
        const cleanId = String(id).replace(/^EX-/, "");
        if (mongoose.Types.ObjectId.isValid(cleanId)) {
          return new mongoose.Types.ObjectId(cleanId);
        }
        return null;
      })
      .filter(id => id !== null);

    if (validIds.length === 0) {
      return responseBadRequest(res, t("no_valid_transaction_ids"));
    }

    const result = await TransactionModel.deleteMany({
      _id: { $in: validIds },
      fund_type: 'EXCHANGE'
    });

    return responseSuccess(
      res,
      { deletedCount: result.deletedCount },
      t("successfully_deleted_exchange_transactions", result.deletedCount)
    );
  } catch (error) {
    console.error("Error bulk deleting exchange transactions:", error);
    return responseServerError(res);
  }
};

