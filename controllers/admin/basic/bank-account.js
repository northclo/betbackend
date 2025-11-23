import { responseSuccess, responseServerError } from "../../../helper/response.js";
import BankAccountModel from "../../../models/BankAccount.js";

export const getBankAccounts = async (req, res) => {
    try {
        const bankAccounts = await BankAccountModel.find({})
            .select('_id bank_name')
            .sort({ bank_name: 1 })
            .lean();

        return responseSuccess(res, bankAccounts || []);
    } catch (error) {
        console.error("Error fetching bank accounts:", error);
        return responseServerError(res);
    }
};

