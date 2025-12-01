import SupportMessage from "../../../models/SupportMessage.js";
import { responseSuccess, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const getCustomNotification = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

    const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];
    
    let filter = {};

    if (allAccessibleIds.length > 0) {
      filter.$or = [
        { writer: { $in: accessibleUserIds } },
        { writer: { $in: accessiblePartnerIds } }
      ];
    } else {
      filter.writer = { $in: [] };
    }

    const aggregation = await SupportMessage.aggregate([
      {
        $match: filter
      },
      {
        $group: {
          _id: null,
          new: {
            $sum: {
              $cond: [{ $eq: ["$status", "NEW"] }, 1, 0]
            }
          },
          waiting: {
            $sum: {
              $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0]
            }
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0]
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
    console.error("Error fetching custom notification:", error);
    return responseServerError(res);
  }
};

