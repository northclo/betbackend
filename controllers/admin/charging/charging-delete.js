import TransactionModel from "../../../models/TransactionHistory.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const deleteChargingTransaction = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { id } = req.params;
    if (!id) {
      return responseBadRequest(res, t("transaction_id_required"));
    }

    const transaction = await TransactionModel.findOne({ 
      _id: id, 
      fund_type: 'CHARGE' 
    });

    if (!transaction) {
      return responseBadRequest(res, t("transaction_not_found"));
    }

    await TransactionModel.findByIdAndDelete(id);

    return responseSuccess(res, null, t("charging_transaction_deleted_successfully"));
  } catch (error) {
    console.error("Error deleting charging transaction:", error);
    return responseServerError(res);
  }
};

