import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const addFund = async (req, res) => {
  const { amount } = req.body;
  const userId = req.session._id;

  if (amount === undefined || amount === null || amount === '') {
    return responseBadRequest(res, t("amount_required"));
  }

  const normalizedAmount = Number(amount);
  if (isNaN(normalizedAmount) || !isFinite(normalizedAmount)) {
    return responseBadRequest(res, t("invalid_amount_number"));
  }

  if (normalizedAmount < 1) {
    return responseBadRequest(res, `${t("minimum_amount")} 1`);
  }

  if (normalizedAmount > 10000000) {
    return responseBadRequest(res, `${t("maximum_amount")} 10,000,000`);
  }

  try {
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { pending_addfund_balance: normalizedAmount } },
      { new: true, select: "own_money pending_addfund_balance" }
    );

    if (!updatedUser) {
      return responseBadRequest(res, t("user_not_found"));
    }

    await TransactionModel.create({
      user_id: userId,
      fund_type: "IMPORT",
      fund_status: "PENDING",
      fund_amount: normalizedAmount
    });

    return responseSuccess(
      res,
      {
        amount: normalizedAmount,
        balance: updatedUser.own_money,
        pending_addfund_balance: updatedUser.pending_addfund_balance || 0,
        status: "PENDING",
      },
      t("fund_request_submitted")
    );
  } catch (error) {
    console.error("Error adding fund:", error);
    return responseBadRequest(res, t("failed_add_fund"));
  }
};

