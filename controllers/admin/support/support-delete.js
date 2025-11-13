import SupportMessage from "../../../models/SupportMessage.js";
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

export const deleteSupportTicket = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { ticketId } = req.params;

  if (!ticketId) {
    return responseBadRequest(res, "Ticket ID is required.");
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
      "Ticket deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting support ticket:", error);
    return responseServerError(res);
  }
};

