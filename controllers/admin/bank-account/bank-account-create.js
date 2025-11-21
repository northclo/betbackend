import BankAccountModel from "../../../models/BankAccount.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const createBankAccount = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { bank_name } = req.body;

    if (!bank_name || !bank_name.trim()) {
      return responseBadRequest(res, t("bank_name_required"));
    }

    const trimmedBankName = bank_name.trim();

    const existingBankAccount = await BankAccountModel.findOne({
      bank_name: trimmedBankName,
    });

    if (existingBankAccount) {
      return responseBadRequest(res, t("bank_name_already_exists"));
    }

    await BankAccountModel.create({
      bank_name: trimmedBankName,
    });

    return responseSuccess(
      res,
      null,
      t("bank_account_created_successfully")
    );
  } catch (error) {
    console.error("Error to create bank account:", error);
    return responseServerError(res);
  }
};

