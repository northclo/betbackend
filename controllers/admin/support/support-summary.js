import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

export const getSupportSummary = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  try {
    const [
      openTickets,
      inProgressTickets,
      resolvedTickets,
      allTickets,
    ] = await Promise.all([
      SupportMessage.countDocuments({ status: "open" }),
      SupportMessage.countDocuments({ status: "in_progress" }),
      SupportMessage.countDocuments({ status: "resolved" }),
      SupportMessage.find({}).lean(),
    ]);

    // Calculate average response time (in minutes)
    // This is a simplified calculation - you might want to improve this
    let totalResponseTime = 0;
    let ticketsWithReplies = 0;

    allTickets.forEach((ticket) => {
      if (ticket.replies && ticket.replies.length > 0) {
        const firstReply = ticket.replies[0];
        const createdAt = new Date(ticket.createdAt);
        const repliedAt = new Date(firstReply.createdAt);
        const diffMinutes = (repliedAt - createdAt) / (1000 * 60);
        if (diffMinutes > 0) {
          totalResponseTime += diffMinutes;
          ticketsWithReplies++;
        }
      }
    });

    const avgResponseTime = ticketsWithReplies > 0 
      ? Math.round(totalResponseTime / ticketsWithReplies) 
      : 0;

    const summary = {
      open_tickets: openTickets,
      in_progress: inProgressTickets,
      resolved: resolvedTickets,
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

