import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const getChargeNotification = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

    const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];
    
    let filter = {
      fund_type: 'CHARGE'
    };

    if (allAccessibleIds.length > 0) {
      filter.user_id = { $in: allAccessibleIds };
    } else {
      filter.user_id = { $in: [] };
    }

    const aggregation = await TransactionModel.aggregate([
      {
        $match: filter
      },
      {
        $group: {
          _id: null,
          new: {
            $sum: {
              $cond: [{ $eq: ["$fund_status", "NEW"] }, 1, 0]
            }
          },
          waiting: {
            $sum: {
              $cond: [{ $eq: ["$fund_status", "WAIT"] }, 1, 0]
            }
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$fund_status", "COMPLETE"] }, 1, 0]
            }
          }
        }
      }
    ]);

    const stats = aggregation[0] || {
      new: 0,
      waiting: 0,
      completed: 0
    };

    return responseSuccess(res, {
      new: stats.new || 0,
      waiting: stats.waiting || 0,
      completed: stats.completed || 0
    });
  } catch (error) {
    console.error("Error fetching charge notification:", error);
    return responseServerError(res);
  }
};

