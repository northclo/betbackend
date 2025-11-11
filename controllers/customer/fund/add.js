import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";

export const addFund = async (req, res) => {
  const { amount } = req.body;
  const userId = req.session._id;

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 1) {
    return responseBadRequest(res, "Minimum amount is 1");
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

