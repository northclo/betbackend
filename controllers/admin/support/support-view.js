import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseSuccess,
  responseNotFound,
  responseBadRequest,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const viewSupportTicket = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

    const { ticketId } = req.params;

    if (!ticketId) {
      return responseBadRequest(res, t("ticket_id_required"));
    }

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return responseBadRequest(res, t("invalid_ticket_id_format"));
    }
    const ticket = await SupportMessage.findById(ticketId).lean();

    if (!ticket) {
      return responseNotFound(res);
    }

    const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];
    if (!allAccessibleIds.some(aid => aid.toString() === ticket.writer.toString())) {
      return responseNotFound(res);
    }

    let userId = null;
    let userNickname = t("unknown");
    let userRole = "user";
    let parentPartnerName = null;
    let answererName = null;

    if (ticket.writer) {
      try {
        userId = ticket.writer.toString();
        const user = await UserModel.findById(ticket.writer).lean();
        if (user) {
          userNickname = user.user_nickname || t("unknown");
          const partner = await PartnerModel.findOne({ user_id: user._id }).lean();
          if (partner) {
            userRole = "partner";
          }

          const userPartnerId = user.ownpartner_id;
          if (userPartnerId) {
            const userPartner = await PartnerModel.findById(userPartnerId).lean();
            if (userPartner) {
              parentPartnerName = userPartner.nickname || null;
            }
          }
        } else {
          const partner = await PartnerModel.findById(ticket.writer).lean();
          if (partner) {
            userNickname = partner.nickname || t("unknown");
            userRole = "partner";
            
            if (partner.parent_partner_id) {
              const parentPartner = await PartnerModel.findById(partner.parent_partner_id).lean();
              if (parentPartner) {
                parentPartnerName = parentPartner.nickname || null;
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user/partner:", error);
      }
    }

    if (ticket.answerer_id) {
      try {
        const answerer = await PartnerModel.findById(ticket.answerer_id).lean();
        if (answerer) {
          answererName = answerer.nickname || null;
        }
      } catch (error) {
        console.error("Error fetching answerer:", error);
      }
    }

    const ticketData = {
      id: ticket._id.toString(),
      title: ticket.title || "",
      userId: userId,
      userNickname: userNickname,
      userRole: userRole,
      parentPartnerName: parentPartnerName,
      firstMessageDate: ticket.first_message_date ? new Date(ticket.first_message_date).toISOString() : (ticket.createdAt ? new Date(ticket.createdAt).toISOString() : null),
      messageSendDate: ticket.send_date ? new Date(ticket.send_date).toISOString() : (ticket.createdAt ? new Date(ticket.createdAt).toISOString() : null),
      ipAddress: ticket.ip_address || "-",
      answerDate: ticket.answer_date ? new Date(ticket.answer_date).toISOString() : null,
      answererName: answererName,
      status: ticket.status || "PENDING",
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

