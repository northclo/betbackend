import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseSuccess,
  responseNotFound,
  responseBadRequest,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const viewSupportTicket = async (req, res) => {
  const { ticketId } = req.params;

  if (!ticketId) {
    return responseBadRequest(res, t("ticket_id_required"));
  }

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return responseBadRequest(res, t("invalid_ticket_id_format"));
  }

  try {
    const ticket = await SupportMessage.findById(ticketId).lean();

    if (!ticket) {
      return responseNotFound(res);
    }

    let userId = null;
    let userNickname = ticket.user_nickname || t("unknown");
    let userRole = "user";
    let parentPartnerName = null;

    if (ticket.userId) {
      try {
        userId = ticket.userId.toString();
        const user = await UserModel.findById(ticket.userId).lean();
        if (user) {
          userNickname = user.user_nickname || t("unknown");
          const partner = await PartnerModel.findOne({ user_id: user._id }).lean();
          if (partner) {
            userRole = "partner";
          }

          const userPartnerId = user.partner_id;
          if (userPartnerId) {
            const userPartner = await PartnerModel.findById(userPartnerId).lean();
            if (userPartner && userPartner.parent_partner_id) {
              const parentPartner = await PartnerModel.findById(userPartner.parent_partner_id).lean();
              if (parentPartner) {
                parentPartnerName = parentPartner.nickname || parentPartner.partner_id || null;
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    }

    const ticketData = {
      id: ticket._id.toString(),
      title: ticket.title || "",
      userId: userId,
      userNickname: userNickname,
      userRole: userRole,
      parentPartnerName: parentPartnerName,
      firstMessageDate: ticket.firstMessageDate ? new Date(ticket.firstMessageDate).toISOString() : (ticket.createdAt ? new Date(ticket.createdAt).toISOString() : null),
      messageSendDate: ticket.sendDate ? new Date(ticket.sendDate).toISOString() : (ticket.createdAt ? new Date(ticket.createdAt).toISOString() : null),
      ipAddress: ticket.ipAddress || "-",
      answerDate: ticket.answerDate ? new Date(ticket.answerDate).toISOString() : null,
      status: ticket.status || "pending",
      question: ticket.question || "",
      answer: ticket.answer || "",
      createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : null,
      updated_at: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : null,
    };

    return responseSuccess(res, ticketData);
  } catch (error) {
    console.error("Error fetching support ticket:", error);
    return responseServerError(res);
  }
};

