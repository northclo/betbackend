import AnnouncementModel from "../../../models/Announcement.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const deleteAnnouncement = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);

    const { announcementId } = req.params;
    if (!announcementId) {
      return responseBadRequest(res, t("announcement_id_required"));
    }

    const existing = await AnnouncementModel.findById(announcementId).lean();
    if (!existing) {
      return responseBadRequest(res, t("announcement_not_found"));
    }

    if (!accessiblePartnerIds.some(pid => pid.toString() === existing.author.toString())) {
      return responseBadRequest(res, t("announcement_not_found"));
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

