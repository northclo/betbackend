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

const normalizeStatus = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!["open", "in_progress", "resolved"].includes(normalized)) {
    return undefined;
  }

  return normalized;
};

const normalizePriority = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!["low", "medium", "high"].includes(normalized)) {
    return undefined;
  }

  return normalized;
};

export const updateSupportTicket = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { ticketId } = req.params;
  const { status, priority, assigned_to } = req.body;

  if (!ticketId) {
    return responseBadRequest(res, "Ticket ID is required.");
  }

  try {
    const ticket = await SupportMessage.findById(ticketId);

    if (!ticket) {
      return responseNotFound(res);
    }

    const updateData = {};

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus !== undefined) {
      updateData.status = normalizedStatus;
    }

    const normalizedPriority = normalizePriority(priority);
    if (normalizedPriority !== undefined) {
      updateData.priority = normalizedPriority;
    }

    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to ? String(assigned_to).trim() : null;
    }

    Object.assign(ticket, updateData);
    await ticket.save();

    return responseSuccess(
      res,
      { id: ticket._id.toString() },
      "Ticket updated successfully."
    );
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return responseServerError(res);
  }
};

