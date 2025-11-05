import UserModel from "../../../models/User.js";
import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";

export const addFund = async (req, res) => {
  const { amount, payment_method } = req.body;
  const userId = req.session._id;

  if (!amount || amount < 1000) {
    return responseBadRequest(res, "Minimum amount is 1,000");
  }

  try {
    const user = await UserModel.findOne({ _id: userId });
    if (!user) {
      return responseBadRequest(res, "User not found");
    }

    const transaction = await TransactionModel.create({
      user_id: userId,
      action_user: userId,
      fund_type: "IMPORT",
      fund_status: "PENDING",
      fund_amount: amount,
      payment_method: payment_method || "bank_transfer",
    });


    await UserModel.updateOne(
      { _id: userId },
      { $inc: { own_money: amount } }
    );

    await TransactionModel.updateOne(
      { _id: transaction._id },
      { fund_status: "COMPLETE" }
    );

    const updatedUser = await UserModel.findOne({ _id: userId });

    return responseSuccess(res, {
      transaction_id: transaction._id,
      amount: amount,
      balance: updatedUser.own_money,
      status: "COMPLETE",
    }, "Fund added successfully");
  } catch (error) {
    console.error("Error adding fund:", error);
    return responseBadRequest(res, "Failed to add fund. Please try again.");
  }
};

