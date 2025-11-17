import AnnouncementModel from "../../../models/Announcement.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

export const deleteAnnouncement = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { announcementId } = req.params;
  if (!announcementId) {
    return responseBadRequest(res, "Announcement id is required.");
  }

  // Admin can delete any announcement (not restricted to their own)
  const deleted = await AnnouncementModel.findOneAndDelete({ _id: announcementId });

  if (!deleted) {
    return responseBadRequest(res, "Announcement not found.");
  }

  return responseSuccess(res, null, "Announcement deleted successfully.");
};

