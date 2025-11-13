import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";

const MIN_WITHDRAW_AMOUNT = 1;

export const withdrawFund = async (req, res) => {
  const { amount } = req.body;
  const userId = req.session._id;

  if (amount === undefined || amount === null || amount === '') {
    return responseBadRequest(res, "Withdrawal amount is required");
  }

  const normalizedAmount = Number(amount);
  if (isNaN(normalizedAmount) || !isFinite(normalizedAmount)) {
    return responseBadRequest(res, "Invalid amount. Please enter a valid number");
  }

  if (normalizedAmount < MIN_WITHDRAW_AMOUNT) {
    return responseBadRequest(
      res,
      `Minimum withdrawal amount is ${MIN_WITHDRAW_AMOUNT.toLocaleString()}`
    );
  }

  if (normalizedAmount > 10000000) {
    return responseBadRequest(res, "Maximum withdrawal amount is 10,000,000");
  }

  try {
    const user = await UserModel.findById(userId).select("own_money pending_refund_balance");

    if (!user) {
      return responseBadRequest(res, "User not found");
    }

    if (normalizedAmount > (user.own_money || 0)) {
      return responseBadRequest(res, "Insufficient balance");
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        $inc: {
          own_money: -normalizedAmount,
          pending_refund_balance: normalizedAmount,
        },
      },
      { new: true, select: "own_money pending_refund_balance" }
    );

    await TransactionModel.create({
      user_id: userId,
      fund_type: "OUTGOING",
      fund_status: "PENDING",
      fund_amount: normalizedAmount
    });

    return responseSuccess(
      res,
      {
        amount: normalizedAmount,
        balance: updatedUser.own_money,
        pending_refund_balance: updatedUser.pending_refund_balance,
        status: "PENDING",
      },
      "Withdrawal request submitted and awaiting approval."
    );
  } catch (error) {
    console.error("Error submitting withdrawal request:", error);
    return responseBadRequest(res, "Failed to submit withdrawal request");
  }
};


