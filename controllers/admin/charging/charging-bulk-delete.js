import mongoose from "mongoose";
import TransactionModel from "../../../models/TransactionHistory.js";
import {
  responseBadRequest,
  responseSuccess,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const bulkDeleteChargingTransactions = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return responseBadRequest(res, t("transaction_ids_required"));
    }

    const validIds = ids
      .map(id => {
        const cleanId = String(id).replace(/^REQ-/, "");
        if (mongoose.Types.ObjectId.isValid(cleanId)) {
          return new mongoose.Types.ObjectId(cleanId);
        }
        return null;
      })
      .filter(id => id !== null);

    if (validIds.length === 0) {
      return responseBadRequest(res, t("no_valid_transaction_ids"));
    }

    const filter = {
      _id: { $in: validIds },
      fund_type: 'CHARGE'
    };

    const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];
    if (allAccessibleIds.length > 0) {
      filter.user_id = { $in: allAccessibleIds };
    } else {
      filter.user_id = { $in: [] };
    }

    const result = await TransactionModel.deleteMany(filter);

    return responseSuccess(
      res,
      { deletedCount: result.deletedCount },
      t("successfully_deleted_charging_transactions", result.deletedCount)
    );
  } catch (error) {
    console.error("Error bulk deleting charging transactions:", error);
    return responseServerError(res);
  }
};

