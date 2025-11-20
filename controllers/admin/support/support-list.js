import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseSuccess,
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
  try {
  const { 
    status, 
    searchType,
    keyword,
    startDate,
    endDate,
    page = 1, 
    limit = 10 
  } = req.query;

  const filter = {};

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    filter.status = normalizedStatus;
  }

  if (startDate || endDate) {
    filter.firstMessageDate = filter.firstMessageDate || {};
    if (startDate) {
      try {
        const dateParts = String(startDate).split('-');
        if (dateParts.length === 3) {
          const [year, month, day] = dateParts.map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
            filter.firstMessageDate.$gte = start;
          }
        }
      } catch (error) {
        console.error("Error parsing startDate:", error);
      }
    }
    if (endDate) {
      try {
        const dateParts = String(endDate).split('-');
        if (dateParts.length === 3) {
          const [year, month, day] = dateParts.map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
            filter.firstMessageDate.$lte = end;
          }
        }
      } catch (error) {
        console.error("Error parsing endDate:", error);
      }
    }
  }

  if (keyword && String(keyword).trim().length > 0) {
    const keywordTrimmed = String(keyword).trim();
    const keywordRegex = new RegExp(keywordTrimmed, "i");

    if (searchType) {
      const searchTypeLower = String(searchType).toLowerCase().trim();
      
      if (searchTypeLower === "user_nickname") {
        try {
          const users = await UserModel.find({
            user_nickname: keywordRegex
          }).select("_id").lean();
          const userIds = users.map(u => u._id);
          if (userIds.length > 0) {
            filter.userId = { $in: userIds };
          } else {
            filter._id = { $in: [] };
          }
        } catch (error) {
          console.error("Error searching by user_nickname:", error);
          filter._id = { $in: [] };
        }
      } else if (searchTypeLower === "user_id") {
        try {
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
        } catch (error) {
          console.error("Error searching by user_id:", error);
          filter._id = { $in: [] };
        }
      } else if (searchTypeLower === "title") {
        filter.title = keywordRegex;
      } else if (searchTypeLower === "content") {
        filter.$or = [
          { question: keywordRegex },
          { answer: keywordRegex }
        ];
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
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    return responseServerError(res);
  }
};

