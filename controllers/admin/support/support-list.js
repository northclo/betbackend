import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseSuccess,
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

const toSupportTicketDto = async (ticket) => {
  let userId = null;
  let userNickname = ticket.user_nickname || t("unknown");
  let userRole = "user";
  let parentPartnerName = null;

  if (ticket.userId) {
    try {
      userId = ticket.userId.toString();
      const user = await UserModel.findById(ticket.userId).lean();
      if (user) {
        userNickname = ticket.user_nickname || user.user_nickname || user.user_name || user.user_email || t("unknown");
        const partner = await PartnerModel.findOne({ user_id: user._id }).lean();
        if (partner) {
          userRole = "partner";
        }

        const userPartnerId = user.own_partner_id || user.partner_id;
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

  return {
    id: ticket._id.toString(),
    no: null,
    title: ticket.title || "",
    userId: userId,
    userNickname: userNickname,
    userRole: userRole,
    userDisplay: `${userNickname}${userId ? `(${userId.slice(-8)})` : ""}${userRole === "partner" ? "(partner)" : "(user)"}`,
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
};

export const listSupportTickets = async (req, res) => {
  const { 
    status, 
    searchType,
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

  if (startDate || endDate) {
    filter.firstMessageDate = filter.firstMessageDate || {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.firstMessageDate.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.firstMessageDate.$lte = end;
    }
  }

  if (keyword && String(keyword).trim().length > 0) {
    const keywordTrimmed = String(keyword).trim();
    const keywordRegex = new RegExp(keywordTrimmed, "i");

    if (searchType) {
      const searchTypeLower = String(searchType).toLowerCase().trim();
      
      if (searchTypeLower === "user_nickname") {
        const users = await UserModel.find({
          user_nickname: keywordRegex
        }).select("_id").lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          filter.userId = { $in: userIds };
        } else {
          filter._id = { $in: [] };
        }
      } else if (searchTypeLower === "user_id") {
        const userConditions = [
          { user_email: keywordRegex },
          { user_name: keywordRegex }
        ];
        
        if (keywordTrimmed.match(/^[0-9a-fA-F]{24}$/)) {
          userConditions.push({ _id: keywordTrimmed });
        }
        
        const users = await UserModel.find({
          $or: userConditions
        }).select("_id").lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          filter.userId = { $in: userIds };
        } else {
          filter._id = { $in: [] };
        }
      } else if (searchTypeLower === "title") {
        filter.title = keywordRegex;
      } else if (searchTypeLower === "content") {
        filter.question = keywordRegex;
      } else {
        filter.$or = [
          { title: keywordRegex },
          { question: keywordRegex },
          { user_nickname: keywordRegex },
        ];
      }
    } else {
      filter.$or = [
        { title: keywordRegex },
        { question: keywordRegex },
        { user_nickname: keywordRegex },
      ];
    }
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [tickets, total] = await Promise.all([
    SupportMessage.find(filter)
      .sort({ firstMessageDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    SupportMessage.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const items = await Promise.all(tickets.map((ticket) => toSupportTicketDto(ticket)));
  
  items.forEach((item, index) => {
    item.no = (pageNumber - 1) * pageSize + index + 1;
  });

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

