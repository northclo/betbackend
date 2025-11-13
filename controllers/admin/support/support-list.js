import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import {
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

const toSupportTicketDto = async (ticket) => {
  // Get member info
  let member = ticket.name || "Unknown";
  if (ticket.userId) {
    try {
      const user = await UserModel.findById(ticket.userId).lean();
      if (user) {
        member = user.user_nickname || user.user_name || user.user_email || ticket.name || "Unknown";
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  }

  // Generate ticket ID
  const ticketId = `TICKET-${ticket._id.toString().slice(-4).toUpperCase()}`;

  return {
    id: ticket._id.toString(),
    ticket_id: ticketId,
    member: member,
    priority: ticket.priority || "medium",
    status: ticket.status || "open",
    subject: ticket.subject || "",
    updated_at: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : null,
    assigned_to: ticket.assigned_to || null,
    name: ticket.name,
    email: ticket.email,
    message: ticket.message,
    createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : null,
    replies_count: ticket.replies ? ticket.replies.length : 0,
  };
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

export const listSupportTickets = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { 
    status, 
    priority, 
    keyword,
    startDate,
    endDate,
    page = 1, 
    limit = 10 
  } = req.query;

  const filter = {}; // Admin can see all tickets

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    filter.status = normalizedStatus;
  }

  const normalizedPriority = normalizePriority(priority);
  if (normalizedPriority) {
    filter.priority = normalizedPriority;
  }

  // Date range filter
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Keyword search (subject, message, name, email)
  if (keyword && String(keyword).trim().length > 0) {
    const keywordRegex = new RegExp(String(keyword).trim(), "i");
    filter.$or = [
      { subject: keywordRegex },
      { message: keywordRegex },
      { name: keywordRegex },
      { email: keywordRegex },
    ];
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [tickets, total] = await Promise.all([
    SupportMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    SupportMessage.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const items = await Promise.all(tickets.map((ticket) => toSupportTicketDto(ticket)));

  return responseSuccess(res, {
    list: items,
    items: items,
    page: pageNumber,
    pageSize: pageSize,
    limit: pageSize,
    total,
    totalPages,
  });
};

