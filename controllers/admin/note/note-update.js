import moment from "moment";
import PartnerMessageModel from "../../../models/PartnerMessage.js";
import PartnerModel from "../../../models/Partner.js";
import UserModel from "../../../models/User.js";
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

const normalizeExpire = (expire) => {
  if (!expire || expire === "0" || expire === "::No period set::") {
    return null;
  }

  if (expire === "full moon" || expire === "moon") {
    return moment().endOf("month").valueOf();
  } else if (expire === "a week") {
    return moment().add(1, "week").valueOf();
  } else if (expire === "month") {
    return moment().add(1, "month").valueOf();
  } else {
    // Parse format like "1 day", "3 hours", "30 minutes", etc.
    const parts = String(expire).trim().split(" ");
    if (parts.length >= 2) {
      const amount = Number(parts[0]);
      const unit = parts[1].toLowerCase();

      if (isNaN(amount) || amount <= 0) {
        return null;
      }

      const validUnits = [
        "minute",
        "minutes",
        "hour",
        "hours",
        "day",
        "days",
        "week",
        "weeks",
        "month",
        "months",
      ];
      const normalizedUnit = unit.endsWith("s") ? unit : unit + "s";

      if (!validUnits.includes(normalizedUnit)) {
        return null;
      }

      return moment().add(amount, normalizedUnit).valueOf();
    }
  }

  return null;
};

const normalizePayload = (payload) => {
  const normalized = {};

  if (payload.title !== undefined) {
    normalized.title = String(payload.title || "").trim();
  }

  if (payload.content !== undefined) {
    normalized.content = String(payload.content || "").trim();
  }

  if (payload.partnerId !== undefined) {
    const partnerId = String(payload.partnerId || "").trim();
    normalized.partner_id = partnerId.length ? partnerId : null;
  }

  if (payload.expire !== undefined) {
    normalized.expire_at = normalizeExpire(payload.expire);
  } else if (payload.expire_at !== undefined) {
    if (payload.expire_at === null || payload.expire_at === 0) {
      normalized.expire_at = null;
    } else {
      const expireAt = Number(payload.expire_at);
      if (!isNaN(expireAt) && expireAt > 0) {
        normalized.expire_at = expireAt;
      }
    }
  }

  return normalized;
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

export const updateNote = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { noteId } = req.params;
  if (!noteId) {
    return responseBadRequest(res, "Note id is required.");
  }

  const payload = normalizePayload(req.body || {});

  if (payload.title !== undefined && !payload.title) {
    return responseBadRequest(res, "Title cannot be empty.");
  }

  if (payload.content !== undefined && !payload.content) {
    return responseBadRequest(res, "Content cannot be empty.");
  }

  // Validate partner_id if provided
  if (payload.partner_id) {
    const partner = await PartnerModel.findOne({
      partner_id: payload.partner_id,
    }).lean();
    if (!partner) {
      return responseBadRequest(res, "Partner not found.");
    }
  }

  const updated = await PartnerMessageModel.findOneAndUpdate(
    { _id: noteId, type: messageType.note },
    payload,
    { new: true, runValidators: true }
  ).lean();

  if (!updated) {
    return responseBadRequest(res, "Note not found.");
  }

  const dto = await toNoteDto(updated);
  return responseSuccess(res, dto, "Note updated successfully.");
};
