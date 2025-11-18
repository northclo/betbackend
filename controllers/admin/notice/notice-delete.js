import NoticeModel from "../../../models/Notice.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { getSubPartnerIds, normalizePartnerIds } from "./notice-utils.js";

export const deleteNotice = async (req, res) => {
  const adminId = req?.session?._id;
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { noticeId } = req.params;
  if (!noticeId) {
    return responseBadRequest(res, t("notice_id_required"));
  }

  const allowedPartnerIds = await getSubPartnerIds(adminId);

  const notice = await NoticeModel.findById(noticeId).lean();
  
  if (!notice) {
    return responseBadRequest(res, t("notice_not_found"));
  }

  let hasAccess = false;
  
  if (!notice.partner_ids || notice.partner_ids.length === 0) { 
    hasAccess = notice.sender && notice.sender.toString() === adminId;
  } else {
    const normalizedNoticePartnerIds = await normalizePartnerIds(notice.partner_ids);
    hasAccess = normalizedNoticePartnerIds.some(id => allowedPartnerIds.includes(id));
  }

  if (!hasAccess) {
    return responseBadRequest(res, t("notice_not_found"));
  }

  const deleteResult = await NoticeModel.deleteOne({ _id: noticeId });

  if (deleteResult.deletedCount === 0) {
    return responseBadRequest(res, t("notice_not_found"));
  }

  return responseSuccess(res, null, t("notice_deleted_successfully"));
};

