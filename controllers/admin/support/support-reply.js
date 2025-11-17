import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseBadRequest,
  responseSuccess,
  responseNotFound,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const replyToSupportTicket = async (req, res) => {
  const { ticketId } = req.params;
  const { message } = req.body;

  if (!ticketId) {
    return responseBadRequest(res, t("ticket_id_required"));
  }

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return responseBadRequest(res, t("invalid_ticket_id_format"));
  }

  if (!message || String(message).trim().length === 0) {
    return responseBadRequest(res, t("reply_message_required"));
  }

  try {
    const ticket = await SupportMessage.findById(ticketId);

    if (!ticket) {
      return responseNotFound(res);
    }

    const replyMessage = String(message).trim();
    const timestamp = new Date().toISOString();
    const adminReply = `[${t("admin")} - ${timestamp}]: ${replyMessage}`;
    
    if (ticket.answer && ticket.answer.trim().length > 0) {
      ticket.answer = `${ticket.answer}\n\n${adminReply}`;
    } else {
      ticket.answer = adminReply;
    }

    if (!ticket.answerDate) {
      ticket.answerDate = new Date();
    }

    await ticket.save();

    return responseSuccess(
      res,
      { id: ticket._id.toString() },
      t("reply_added_successfully")
    );
  } catch (error) {
    console.error("Error replying to support ticket:", error);
    return responseServerError(res);
  }
};

