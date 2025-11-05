import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess } from "../../../helper/response.js";

export const getFundHistory = async (req, res) => {
  const userId = req.session._id;
  const { limit = 10, skip = 0 } = req.query;

  try {
    const transactions = await TransactionModel.find({
      user_id: userId,
      fund_type: "IMPORT",
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const formattedTransactions = transactions.map((transaction) => ({
      _id: transaction._id,
      amount: transaction.fund_amount,
      payment_method: transaction.payment_method || "bank_transfer",
      status: transaction.fund_status,
      createdAt: transaction.createdAt,
    }));

    return responseSuccess(res, formattedTransactions, "Fund history retrieved successfully");
  } catch (error) {
    console.error("Error fetching fund history:", error);
    return responseSuccess(res, [], "Fund history retrieved successfully");
  }
};

