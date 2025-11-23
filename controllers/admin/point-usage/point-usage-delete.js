import mongoose from "mongoose";
import PointTransactionModel from "../../../models/PointTransaction.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const deletePointUsageTransaction = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

    const { id } = req.params;
    if (!id) {
      return responseBadRequest(res, t("transaction_id_required"));
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return responseBadRequest(res, t("invalid_transaction_id"));
    }

    const objectId = new mongoose.Types.ObjectId(id);

    const transaction = await PointTransactionModel.findById(objectId);
    
    if (!transaction) {
      return responseBadRequest(res, t("transaction_not_found"));
    }

    if (!accessibleUserIds.some(aid => aid.toString() === transaction.user_id.toString())) {
      return responseBadRequest(res, t("transaction_not_found"));
    }

    await PointTransactionModel.findByIdAndDelete(objectId);
    return responseSuccess(res, null, t("transaction_deleted_successfully"));
  } catch (error) {
    console.error("Error deleting point usage transaction:", error);
    return responseServerError(res);
  }
};

