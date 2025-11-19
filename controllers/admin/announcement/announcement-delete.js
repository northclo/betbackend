import AnnouncementModel from "../../../models/Announcement.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const deleteAnnouncement = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { announcementId } = req.params;
    if (!announcementId) {
      return responseBadRequest(res, t("announcement_id_required"));
    }

    const deleted = await AnnouncementModel.findOneAndDelete({ _id: announcementId });

    if (!deleted) {
      return responseBadRequest(res, t("announcement_not_found"));
    }

    return responseSuccess(res, null, t("announcement_deleted_successfully"));
  } catch (error) {
    console.error("Error to delete announcement:", error);
    return responseServerError(res);
  }
};

