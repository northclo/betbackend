import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const getExchangeHistory = async (req, res) => {
  const userId = req.session._id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = parseInt(req.query.limit, 10) || parseInt(req.query.pageSize, 10) || 10;
  const skip = parseInt(req.query.skip, 10);

  const calculatedSkip = skip !== undefined && !isNaN(skip) ? skip : (page - 1) * limit;
  const pageSize = Math.max(1, Math.min(limit, 100)); // Max 100 items per page

  try {
    const filter = {
      user_id: userId,
      fund_type: "EXCHANGE",
    };

    const [total, transactions] = await Promise.all([
      TransactionModel.countDocuments(filter),
      TransactionModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(pageSize)
        .skip(calculatedSkip)
    ]);

    const formattedTransactions = transactions.map((transaction) => ({
      _id: transaction._id,
      amount: transaction.fund_amount,
      original_amount: transaction.original_amount,
      from_currency: transaction.from_currency,
      to_currency: transaction.to_currency,
      exchange_rate: transaction.exchange_rate,
      payment_method: transaction.payment_method || t("default_payment_method_bank_transfer"),
      status: transaction.fund_status || "PENDING",
      createdAt: transaction.createdAt,
    }));

    if (req.query.page || req.query.pageSize) {
      return responseSuccess(res, {
        data: formattedTransactions,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      }, t("exchange_history_retrieved_successfully"));
    }

    return responseSuccess(res, formattedTransactions, t("exchange_history_retrieved_successfully"));
  } catch (error) {
    console.error("Error fetching exchange history:", error);
    if (req.query.page || req.query.pageSize) {
      return responseSuccess(res, {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize,
          totalPages: 1,
        },
      }, t("exchange_history_retrieved_successfully"));
    }
    return responseSuccess(res, [], t("exchange_history_retrieved_successfully"));
  }
};

