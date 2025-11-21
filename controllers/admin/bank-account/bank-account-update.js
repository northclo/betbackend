import BankAccountModel from "../../../models/BankAccount.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const updateBankAccount = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { bankAccountId } = req.params;
    if (!bankAccountId) {
      return responseBadRequest(res, t("bank_account_id_required"));
    }

    const { bank_name } = req.body;

    const existingBankAccount = await BankAccountModel.findById(bankAccountId).lean();
    
    if (!existingBankAccount) {
      return responseBadRequest(res, t("bank_account_not_found"));
    }

    const updateData = {};

    if (bank_name !== undefined) {
      if (!bank_name || !bank_name.trim()) {
        return responseBadRequest(res, t("bank_name_required"));
      }
      
      const trimmedBankName = bank_name.trim();
      
      const duplicateBankAccount = await BankAccountModel.findOne({
        bank_name: trimmedBankName,
        _id: { $ne: bankAccountId }
      });

      if (duplicateBankAccount) {
        return responseBadRequest(res, t("bank_name_already_exists"));
      }

      updateData.bank_name = trimmedBankName;
    }

    if (Object.keys(updateData).length === 0) {
      return responseBadRequest(res, t("no_update_data_provided"));
    }

    const updated = await BankAccountModel.findOneAndUpdate(
      { _id: bankAccountId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return responseBadRequest(res, t("bank_account_not_found"));
    }

    return responseSuccess(
      res,
      null,
      t("bank_account_updated_successfully")
    );
  } catch (error) {
    console.error("Error to update bank account:", error);
    return responseServerError(res);
  }
};

