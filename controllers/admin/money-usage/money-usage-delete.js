import mongoose from "mongoose";
import TransactionModel from "../../../models/TransactionHistory.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const deleteMoneyUsageTransaction = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { id } = req.params;
    if (!id) {
      return responseBadRequest(res, t("transaction_id_required"));
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return responseBadRequest(res, t("invalid_transaction_id"));
    }

    const objectId = new mongoose.Types.ObjectId(id);

    const transaction = await TransactionModel.findById(objectId);
    
    if (!transaction) {
      return responseBadRequest(res, t("transaction_not_found"));
    }

    await TransactionModel.findByIdAndDelete(objectId);
    return responseSuccess(res, null, t("transaction_deleted_successfully"));
  } catch (error) {
    console.error("Error deleting money usage transaction:", error);
    return responseServerError(res);
  }
};

