import BankAccountModel from "../../../models/BankAccount.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const deleteBankAccount = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { bankAccountId } = req.params;
    if (!bankAccountId) {
      return responseBadRequest(res, t("bank_account_id_required"));
    }

    const bankAccount = await BankAccountModel.findById(bankAccountId).lean();
    
    if (!bankAccount) {
      return responseBadRequest(res, t("bank_account_not_found"));
    }

    await BankAccountModel.deleteOne({ _id: bankAccountId });

    return responseSuccess(res, null, t("bank_account_deleted_successfully"));
  } catch (error) {
    console.error("Error to delete bank account:", error);
    return responseServerError(res);
  }
};

