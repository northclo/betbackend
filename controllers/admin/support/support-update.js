import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseBadRequest,
  responseSuccess,
  responseNotFound,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

const normalizeStatus = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!["pending", "resolved", "rejected"].includes(normalized)) {
    return undefined;
  }

  return normalized;
};

export const updateSupportTicket = async (req, res) => {
  const { ticketId } = req.params;
  const { status, answer } = req.body;

  if (!ticketId) {
    return responseBadRequest(res, t("ticket_id_required"));
  }

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return responseBadRequest(res, t("invalid_ticket_id_format"));
  }

  try {
    const ticket = await SupportMessage.findById(ticketId);

    if (!ticket) {
      return responseNotFound(res);
    }

    const updateData = {};

    if (answer !== undefined) {
      const trimmedAnswer = String(answer).trim();
      if (trimmedAnswer.length === 0) {
        return responseBadRequest(res, t("answer_cannot_be_empty"));
      }
      updateData.answer = trimmedAnswer;
      if (!ticket.answerDate) {
        updateData.answerDate = new Date();
      }
    }

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus !== undefined) {
      if (normalizedStatus === "resolved") {
        const hasAnswer = (ticket.answer && ticket.answer.trim().length > 0) || 
                         (updateData.answer && updateData.answer.trim().length > 0);
        if (!hasAnswer) {
          return responseBadRequest(res, t("answer_required_when_resolving"));
        }
        if (!ticket.answerDate && !updateData.answerDate) {
          updateData.answerDate = new Date();
        }
      }
      updateData.status = normalizedStatus;
    }

    Object.assign(ticket, updateData);
    await ticket.save();

    return responseSuccess(
      res,
      { id: ticket._id.toString() },
      t("ticket_updated_successfully")
    );
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return responseServerError(res);
  }
};

