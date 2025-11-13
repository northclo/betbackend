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

export const viewNote = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { noteId } = req.params;
  if (!noteId) {
    return responseBadRequest(res, "Note id is required.");
  }

  const note = await PartnerMessageModel.findOne({
    _id: noteId,
    type: messageType.note,
  }).lean();

  if (!note) {
    return responseBadRequest(res, "Note not found.");
  }

  const dto = await toNoteDto(note);
  return responseSuccess(res, dto);
};

