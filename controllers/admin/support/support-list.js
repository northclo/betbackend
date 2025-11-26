import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseSuccess,
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

const toSupportTicketDto = async (ticket) => {
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
          parentPartnerName = userPartner.nickname || "-";
        }
      }
    } catch (error) {
      console.error("Error fetching user:", error);
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

  return {
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
};

export const listSupportTickets = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

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

    if (accessibleUserIds.length > 0) {
      filter.writer = { $in: accessibleUserIds };
    } else {
      return responseSuccess(res, {
        list: [],
        items: [],
        page: 1,
        pageSize: 10,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    }

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus) {
      filter.status = normalizedStatus;
    }

    if (startDate || endDate) {
      filter.send_date = filter.send_date || {};
      
      if (startDate) {
        try {
          const dateParts = String(startDate).split('-');
          if (dateParts.length === 3) {
            const [year, month, day] = dateParts.map(Number);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day) && year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
              filter.send_date.$gte = start;
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
            if (!isNaN(year) && !isNaN(month) && !isNaN(day) && year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
              filter.send_date.$lte = end;
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
              user_nickname: keywordRegex,
              $or: [
                { partner_id: { $in: accessiblePartnerIds } },
                { ownpartner_id: { $in: accessiblePartnerIds } }
              ]
            }).select("_id").lean();
            const userIds = users.map(u => u._id).filter(id => 
              accessibleUserIds.some(aid => aid.toString() === id.toString())
            );
            if (userIds.length > 0) {
              filter.writer = { $in: userIds };
            } else {
              filter._id = { $in: [] };
            }
          } catch (error) {
            console.error("Error searching by user_nickname:", error);
            filter._id = { $in: [] };
          }
        } else if (searchTypeLower === "user_id") {
          try {
            const userConditions = [];
            
            if (mongoose.Types.ObjectId.isValid(keywordTrimmed) && keywordTrimmed.match(/^[0-9a-fA-F]{24}$/)) {
              const objectId = new mongoose.Types.ObjectId(keywordTrimmed);
              if (accessibleUserIds.some(aid => aid.toString() === objectId.toString())) {
                userConditions.push({ _id: objectId });
              }
            }
            
            userConditions.push(
              { user_name: keywordRegex }
            );
            
            const users = await UserModel.find({
              $and: [
                { $or: userConditions },
                {
                  $or: [
                    { partner_id: { $in: accessiblePartnerIds } },
                    { ownpartner_id: { $in: accessiblePartnerIds } }
                  ]
                }
              ]
            }).select("_id").lean();
            
            const userIds = users
              .map(u => u._id)
              .filter(id => accessibleUserIds.some(aid => aid.toString() === id.toString()));
            
            if (userIds.length > 0) {
              filter.writer = { $in: userIds };
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
          ];
        }
      } else {
        filter.$or = [
          { title: keywordRegex },
          { question: keywordRegex },
        ];
      }
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const [tickets, total] = await Promise.all([
      SupportMessage.find(filter)
        .sort({ first_message_date: -1, createdAt: -1 })
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

