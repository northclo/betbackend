import NoticeModel from "../../../models/Notice.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const deleteNotice = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);

    const { noticeId } = req.params;
    if (!noticeId) {
      return responseBadRequest(res, t("notice_id_required"));
    }

    const notice = await NoticeModel.findById(noticeId).lean();
    
    if (!notice) {
      return responseBadRequest(res, t("notice_not_found"));
    }

    if (!accessiblePartnerIds.some(pid => pid.toString() === notice.writer.toString())) {
      return responseBadRequest(res, t("notice_not_found"));
    }

    const deleteResult = await NoticeModel.deleteOne({ _id: noticeId });

    if (deleteResult.deletedCount === 0) {
      return responseBadRequest(res, t("notice_not_found"));
    }

    return responseSuccess(res, null, t("notice_deleted_successfully"));
  } catch (error) {
    console.error("Error to delete notice:", error);
    return responseServerError(res);
  }
};

