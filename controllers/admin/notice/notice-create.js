import NoticeModel from "../../../models/Notice.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { getSubPartnerIds, normalizePartnerIds } from "./notice-utils.js";

export const createNotice = async (req, res) => {
  const adminId = req?.session?._id;
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { title, content, partnerIds, start_date, end_date } = req.body;

  if (!title || !title.trim()) {
    return responseBadRequest(res, t("title_required"));
  }

  if (!content || !content.trim()) {
    return responseBadRequest(res, t("content_required"));
  }

  let partner_ids = [];
  if (partnerIds && Array.isArray(partnerIds) && partnerIds.length > 0) {
    const normalizedIds = await normalizePartnerIds(partnerIds);
    
    if (normalizedIds.length === 0 && partnerIds.length > 0) {
      return responseBadRequest(res, t("invalid_partner_id"));
    }
    
    const allowedPartnerIds = await getSubPartnerIds(adminId);
    
    const invalidIds = normalizedIds.filter(id => !allowedPartnerIds.includes(id));
    if (invalidIds.length > 0) {
      return responseBadRequest(res, t("invalid_partner_id"));
    }
    
    partner_ids = normalizedIds;
  }
  
  let startDate = null;
  let endDate = null;

  if (start_date !== undefined && start_date !== null && start_date !== "") {
    startDate = new Date(start_date);
    if (isNaN(startDate.getTime())) {
      return responseBadRequest(res, t("invalid_start_date"));
    }
  }

  if (end_date !== undefined && end_date !== null && end_date !== "") {
    endDate = new Date(end_date);
    if (isNaN(endDate.getTime())) {
      return responseBadRequest(res, t("invalid_end_date"));
    }
  }

  if (startDate && endDate && startDate > endDate) {
    return responseBadRequest(res, t("start_date_must_be_before_end_date"));
  }

  if ((startDate && !endDate) || (!startDate && endDate)) {
    return responseBadRequest(res, t("both_start_and_end_date_required"));
  }

  const notice = await NoticeModel.create({
    partner_ids: partner_ids,
    sender: adminId,
    title: title.trim(),
    content: content.trim(),
    start_date: startDate,
    end_date: endDate,
  });

  return responseSuccess(
    res,
    {
      id: notice._id.toString(),
      title: notice.title,
      content: notice.content,
      partner_ids: notice.partner_ids,
      start_date: notice.start_date,
      end_date: notice.end_date,
    },
    t("notice_created_successfully")
  );
};
