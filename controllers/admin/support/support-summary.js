import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseSuccess,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const getSupportSummary = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

    const filter = {};
    if (accessibleUserIds.length > 0) {
      filter.writer = { $in: accessibleUserIds };
    } else {
      return responseSuccess(res, {
        pending: 0,
        resolved: 0,
        rejected: 0,
        total: 0,
        average_response_time: 0,
        average_response_time_formatted: "0m",
      });
    }

    const [
      pendingTickets,
      resolvedTickets,
      rejectedTickets,
      allTickets,
    ] = await Promise.all([
      SupportMessage.countDocuments({ ...filter, status: "PENDING" }),
      SupportMessage.countDocuments({ ...filter, status: "RESOLVED" }),
      SupportMessage.countDocuments({ ...filter, status: "REJECTED" }),
      SupportMessage.find(filter).lean(),
    ]);

    let totalResponseTime = 0;
    let ticketsWithAnswers = 0;

    allTickets.forEach((ticket) => {
      if (ticket.answer_date && ticket.first_message_date) {
        const firstMessageDate = new Date(ticket.first_message_date);
        const answerDate = new Date(ticket.answer_date);
        const diffMinutes = (answerDate - firstMessageDate) / (1000 * 60);
        if (diffMinutes > 0) {
          totalResponseTime += diffMinutes;
          ticketsWithAnswers++;
        }
      }
    });

    const avgResponseTime = ticketsWithAnswers > 0 
      ? Math.round(totalResponseTime / ticketsWithAnswers) 
      : 0;

    const summary = {
      pending: pendingTickets,
      resolved: resolvedTickets,
      rejected: rejectedTickets,
      total: allTickets.length,
      average_response_time: avgResponseTime,
      average_response_time_formatted: avgResponseTime > 0 
        ? `${avgResponseTime}m` 
        : "0m",
    };

    return responseSuccess(res, summary);
  } catch (error) {
    console.error("Error fetching support summary:", error);
    return responseServerError(res);
  }
};

