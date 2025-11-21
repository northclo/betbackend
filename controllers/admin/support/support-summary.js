import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseSuccess,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";

export const getSupportSummary = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const [
      pendingTickets,
      resolvedTickets,
      rejectedTickets,
      allTickets,
    ] = await Promise.all([
      SupportMessage.countDocuments({ status: "PENDING" }),
      SupportMessage.countDocuments({ status: "RESOLVED" }),
      SupportMessage.countDocuments({ status: "REJECTED" }),
      SupportMessage.find({}).lean(),
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

