import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseBadRequest,
  responseSuccess,
  responseNotFound,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const deleteSupportTicket = async (req, res) => {
  const { ticketId } = req.params;

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

