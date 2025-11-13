import PartnerMessageModel from "../../../models/PartnerMessage.js";
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

export const deleteNote = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { noteId } = req.params;
  if (!noteId) {
    return responseBadRequest(res, "Note id is required.");
  }

  const deleted = await PartnerMessageModel.findOneAndDelete({
    _id: noteId,
    type: messageType.note,
  });

  if (!deleted) {
    return responseBadRequest(res, "Note not found.");
  }

  return responseSuccess(res, null, "Note deleted successfully.");
};

