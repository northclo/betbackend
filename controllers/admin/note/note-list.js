import PartnerMessageModel from "../../../models/PartnerMessage.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { messageType } from "../../../const/type.js";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

const toNoteDto = async (note) => {
  // Get sender info
  let sender = "Unknown";
  if (note.sender) {
    try {
      const user = await UserModel.findById(note.sender).lean();
      if (user) {
        sender = user.user_nickname || user.user_name || user.user_email || "Unknown";
      }
    } catch (error) {
      console.error("Error fetching sender:", error);
    }
  }

  // Get partner info
  let partnerName = null;
  if (note.partner_id) {
    try {
      const partner = await PartnerModel.findOne({ partner_id: note.partner_id }).lean();
      if (partner) {
        partnerName = partner.nickname || note.partner_id;
      } else {
        partnerName = note.partner_id;
      }
    } catch (error) {
      console.error("Error fetching partner:", error);
      partnerName = note.partner_id;
    }
  }

  // Check if expired
  const now = Date.now();
  const isExpired = note.expire_at && note.expire_at > 0 && note.expire_at < now;

  return {
    id: note._id.toString(),
    _id: note._id.toString(),
    title: note.title,
    content: note.content,
    partner_id: note.partner_id || null,
    partner_name: partnerName,
    sender: sender,
    sender_id: note.sender ? note.sender.toString() : null,
    type: note.type || messageType.note,
    expire_at: note.expire_at ? note.expire_at : null,
    is_expired: isExpired,
    createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : null,
    updatedAt: note.updatedAt ? new Date(note.updatedAt).toISOString() : null,
  };
};

export const listNotes = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const {
    partnerId,
    keyword,
    startDate,
    endDate,
    expired,
    page = 1,
    limit = 10,
  } = req.query;

  const filter = { type: messageType.note };

  // Filter by partner
  if (partnerId && String(partnerId).trim().length > 0) {
    filter.partner_id = String(partnerId).trim();
  }

  // Filter by expired status
  const now = Date.now();
  if (expired === "true" || expired === true) {
    filter.$or = [
      { expire_at: { $lt: now, $gt: 0 } },
      { expire_at: { $exists: false } },
    ];
  } else if (expired === "false" || expired === false) {
    filter.$or = [
      { expire_at: null },
      { expire_at: 0 },
      { expire_at: { $gte: now } },
    ];
  }

  // Date range filter (based on createdAt)
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

  // Keyword search (title or content)
  if (keyword && String(keyword).trim().length > 0) {
    const keywordRegex = new RegExp(String(keyword).trim(), "i");
    if (filter.$or) {
      filter.$and = [
        { $or: filter.$or },
        { $or: [{ title: keywordRegex }, { content: keywordRegex }] },
      ];
      delete filter.$or;
    } else {
      filter.$or = [{ title: keywordRegex }, { content: keywordRegex }];
    }
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [notes, total] = await Promise.all([
    PartnerMessageModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    PartnerMessageModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const items = await Promise.all(notes.map((note) => toNoteDto(note)));

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

