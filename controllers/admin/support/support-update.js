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
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

const normalizeStatus = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toUpperCase();
  if (!["PENDING", "RESOLVED", "REJECTED"].includes(normalized)) {
    return undefined;
  }

  return normalized;
};

export const updateSupportTicket = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

    const { ticketId } = req.params;
    const { status, answer } = req.body;

    if (!ticketId) {
      return responseBadRequest(res, t("ticket_id_required"));
    }

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return responseBadRequest(res, t("invalid_ticket_id_format"));
    }
    const ticket = await SupportMessage.findById(ticketId);

    if (!ticket) {
      return responseNotFound(res);
    }

    if (!accessibleUserIds.some(aid => aid.toString() === ticket.writer.toString())) {
      return responseNotFound(res);
    }

    const updateData = {};

    if (answer !== undefined) {
      const trimmedAnswer = String(answer).trim();
      if (trimmedAnswer.length === 0) {
        return responseBadRequest(res, t("answer_cannot_be_empty"));
      }
      updateData.answer = trimmedAnswer;
      if (!ticket.answer_date) {
        updateData.answer_date = new Date();
      }
      if (!ticket.answerer_id) {
        updateData.answerer_id = adminId;
      }
    }

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus !== undefined) {
      if (normalizedStatus === "RESOLVED") {
        const hasAnswer = (ticket.answer && ticket.answer.trim().length > 0) || 
                         (updateData.answer && updateData.answer.trim().length > 0);
        if (!hasAnswer) {
          return responseBadRequest(res, t("answer_required_when_resolving"));
        }
        if (!ticket.answer_date && !updateData.answer_date) {
          updateData.answer_date = new Date();
        }
        if (!ticket.answerer_id && !updateData.answerer_id) {
          updateData.answerer_id = adminId;
        }
      } else if (normalizedStatus === "REJECTED") {
        updateData.answer_date = null;
        updateData.answerer_id = adminId;
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

