import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";

export const addFund = async (req, res) => {
  const { amount } = req.body;
  const userId = req.session._id;

  if (amount === undefined || amount === null || amount === '') {
    return responseBadRequest(res, "Amount is required");
  }

  const normalizedAmount = Number(amount);
  if (isNaN(normalizedAmount) || !isFinite(normalizedAmount)) {
    return responseBadRequest(res, "Invalid amount. Please enter a valid number");
  }

  if (normalizedAmount < 1) {
    return responseBadRequest(res, "Minimum amount is 1");
  }

  if (normalizedAmount > 10000000) {
    return responseBadRequest(res, "Maximum amount is 10,000,000");
  }

  try {
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { pending_addfund_balance: normalizedAmount } },
      { new: true, select: "current_balance pending_addfund_balance" }
    );

    if (!updatedUser) {
      return responseBadRequest(res, "User not found");
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
        balance: updatedUser.current_balance,
        pending_addfund_balance: updatedUser.pending_addfund_balance || 0,
        status: "PENDING",
      },
      "Fund request submitted and awaiting approval"
    );
  } catch (error) {
    console.error("Error adding fund:", error);
    return responseBadRequest(res, "Failed to add fund. Please try again.");
  }
};

