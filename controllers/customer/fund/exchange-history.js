import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseSuccess, responseServerError } from "../../../helper/response.js";
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

    const formattedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        let userNickname = null;
        if (transaction.user_id) {
          try {
            let user = await UserModel.findById(transaction.user_id).select('user_nickname').lean();
            if (!user) {
              user = await PartnerModel.findById(transaction.user_id).select('nickname').lean();
            }
            if (user) {
              userNickname = user.user_nickname || user.nickname || null;
            }
          } catch (error) {
            console.error("Error fetching user nickname:", error);
          }
        }
        
        return {
          _id: transaction._id,
          amount: transaction.fund_amount,
          user_nickname: userNickname,
          status: transaction.fund_status || "WAIT",
          createdAt: transaction.createdAt,
        };
      })
    );

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
    return responseServerError(res);
  }
};

