import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseSuccess,
  responseServerError,
} from "../../../helper/response.js";

export const getSupportSummary = async (req, res) => {
  try {
    const [
      pendingTickets,
      resolvedTickets,
      rejectedTickets,
      allTickets,
    ] = await Promise.all([
      SupportMessage.countDocuments({ status: "pending" }),
      SupportMessage.countDocuments({ status: "resolved" }),
      SupportMessage.countDocuments({ status: "rejected" }),
      SupportMessage.find({}).lean(),
    ]);

    let totalResponseTime = 0;
    let ticketsWithAnswers = 0;

    allTickets.forEach((ticket) => {
      if (ticket.answerDate && ticket.firstMessageDate) {
        const firstMessageDate = new Date(ticket.firstMessageDate);
        const answerDate = new Date(ticket.answerDate);
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

