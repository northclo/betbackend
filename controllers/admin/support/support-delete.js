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

export const deleteSupportTicket = async (req, res) => {
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
    const ticket = await SupportMessage.findById(ticketId);

    if (!ticket) {
      return responseNotFound(res);
    }

    if (!accessibleUserIds.some(aid => aid.toString() === ticket.writer.toString())) {
      return responseNotFound(res);
    }

    await SupportMessage.findByIdAndDelete(ticketId);

    return responseSuccess(
      res,
      { id: ticketId },
      t("ticket_deleted_successfully")
    );
  } catch (error) {
    console.error("Error deleting support ticket:", error);
    return responseServerError(res);
  }
};

