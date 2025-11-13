import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseNotFound,
  responseServerError,
} from "../../../helper/response.js";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

export const replyToSupportTicket = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { ticketId } = req.params;
  const { message } = req.body;

  if (!ticketId) {
    return responseBadRequest(res, "Ticket ID is required.");
  }

  if (!message || String(message).trim().length === 0) {
    return responseBadRequest(res, "Reply message is required.");
  }

  try {
    const ticket = await SupportMessage.findById(ticketId);

    if (!ticket) {
      return responseNotFound(res);
    }

    // Get admin user info
    let adminName = "Admin";
    try {
      const adminUser = await UserModel.findById(adminId).lean();
      if (adminUser) {
        adminName = adminUser.user_nickname || adminUser.user_name || adminUser.user_email || "Admin";
      }
    } catch (error) {
      console.error("Error fetching admin user:", error);
    }

    // Add reply
    const reply = {
      message: String(message).trim(),
      replied_by: adminId,
      replied_by_name: adminName,
      is_admin: true,
      createdAt: new Date(),
    };

    ticket.replies = ticket.replies || [];
    ticket.replies.push(reply);

    // If ticket is resolved, keep it resolved. Otherwise, set to in_progress
    if (ticket.status !== "resolved") {
      ticket.status = "in_progress";
    }

    await ticket.save();

    return responseSuccess(
      res,
      { id: ticket._id.toString(), reply_id: ticket.replies[ticket.replies.length - 1]._id },
      "Reply added successfully."
    );
  } catch (error) {
    console.error("Error replying to support ticket:", error);
    return responseServerError(res);
  }
};

