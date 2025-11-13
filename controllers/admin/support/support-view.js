import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import {
  responseSuccess,
  responseUnAutherized,
  responseNotFound,
  responseBadRequest,
  responseServerError,
} from "../../../helper/response.js";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

export const viewSupportTicket = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { ticketId } = req.params;

  if (!ticketId) {
    return responseBadRequest(res, "Ticket ID is required.");
  }

  try {
    const ticket = await SupportMessage.findById(ticketId).lean();

    if (!ticket) {
      return responseNotFound(res);
    }

    // Get member info
    let member = ticket.name || "Unknown";
    if (ticket.userId) {
      try {
        const user = await UserModel.findById(ticket.userId).lean();
        if (user) {
          member = user.user_nickname || user.user_name || user.user_email || ticket.name || "Unknown";
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    }

    // Generate ticket ID
    const ticketIdFormatted = `TICKET-${ticket._id.toString().slice(-4).toUpperCase()}`;

    const ticketData = {
      id: ticket._id.toString(),
      ticket_id: ticketIdFormatted,
      member: member,
      priority: ticket.priority || "medium",
      status: ticket.status || "open",
      subject: ticket.subject || "",
      updated_at: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : null,
      assigned_to: ticket.assigned_to || null,
      name: ticket.name,
      email: ticket.email,
      message: ticket.message,
      createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : null,
      replies: ticket.replies ? ticket.replies.map(reply => ({
        message: reply.message,
        replied_by: reply.replied_by,
        replied_by_name: reply.replied_by_name,
        is_admin: reply.is_admin,
        createdAt: reply.createdAt ? new Date(reply.createdAt).toISOString() : null,
      })) : [],
    };

    return responseSuccess(res, ticketData);
  } catch (error) {
    console.error("Error fetching support ticket:", error);
    return responseServerError(res);
  }
};

