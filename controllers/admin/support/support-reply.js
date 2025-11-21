import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseBadRequest,
  responseSuccess,
  responseNotFound,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const replyToSupportTicket = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

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

    const ticket = await SupportMessage.findById(ticketId);

    if (!ticket) {
      return responseNotFound(res);
    }

    ticket.answer = String(message).trim();
    
    if (!ticket.answer_date) {
      ticket.answer_date = new Date();
    }

    if (!ticket.answerer_id) {
      ticket.answerer_id = adminId;
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

