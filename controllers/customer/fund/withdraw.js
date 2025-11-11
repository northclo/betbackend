import UserModel from "../../../models/User.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";

const MIN_WITHDRAW_AMOUNT = 1;

export const withdrawFund = async (req, res) => {
  const { amount } = req.body;

  const userId = req.session._id;

  if (!amount || Number.isNaN(Number(amount))) {
    return responseBadRequest(res, "Withdrawal amount is required");
  }

  const normalizedAmount = Number(amount);

  if (normalizedAmount < MIN_WITHDRAW_AMOUNT) {
    return responseBadRequest(
      res,
      `Minimum withdrawal amount is ${MIN_WITHDRAW_AMOUNT.toLocaleString()}`
    );
  }

  try {
    const user = await UserModel.findById(userId).select("current_balance pending_refund_balance");

    if (!user) {
      return responseBadRequest(res, "User not found");
    }

    if (normalizedAmount > (user.current_balance || 0)) {
      return responseBadRequest(res, "Insufficient balance");
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        $inc: {
          current_balance: -normalizedAmount,
          pending_refund_balance: normalizedAmount,
        },
      },
      { new: true, select: "current_balance pending_refund_balance" }
    );

    return responseSuccess(
      res,
      {
        amount: normalizedAmount,
        balance: updatedUser.current_balance,
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


