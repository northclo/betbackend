import NoticeModel from "../../../models/Notice.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { getSubPartnerIds, normalizePartnerIds } from "./notice-utils.js";

export const updateNotice = async (req, res) => {
  const adminId = req?.session?._id;
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { noticeId } = req.params;
  if (!noticeId) {
    return responseBadRequest(res, t("notice_id_required"));
  }

  const { title, content, partnerIds, start_date, end_date } = req.body;

  const allowedPartnerIds = await getSubPartnerIds(adminId);

  const existingNotice = await NoticeModel.findById(noticeId).lean();
  
  if (!existingNotice) {
    return responseBadRequest(res, t("notice_not_found"));
  }

  let hasAccess = false;
  
  if (!existingNotice.partner_ids || existingNotice.partner_ids.length === 0) {
    hasAccess = existingNotice.sender && existingNotice.sender.toString() === adminId;
  } else {
    const normalizedNoticePartnerIds = await normalizePartnerIds(existingNotice.partner_ids);
    hasAccess = normalizedNoticePartnerIds.some(id => allowedPartnerIds.includes(id));
  }

  if (!hasAccess) {
    return responseBadRequest(res, t("notice_not_found"));
  }

  const updateData = {};

  if (title !== undefined) {
    if (!title || !title.trim()) {
      return responseBadRequest(res, t("title_required"));
    }
    updateData.title = title.trim();
  }

  if (content !== undefined) {
    if (!content || !content.trim()) {
      return responseBadRequest(res, t("content_required"));
    }
    updateData.content = content.trim();
  }

  if (partnerIds !== undefined) {
    if (Array.isArray(partnerIds) && partnerIds.length > 0) {
      const normalizedIds = await normalizePartnerIds(partnerIds);
      
      if (normalizedIds.length === 0 && partnerIds.length > 0) {
        return responseBadRequest(res, t("invalid_partner_id"));
      }
      
      const invalidIds = normalizedIds.filter(id => !allowedPartnerIds.includes(id));
      if (invalidIds.length > 0) {
        return responseBadRequest(res, t("invalid_partner_id"));
      }
      updateData.partner_ids = normalizedIds;
    } else {
      updateData.partner_ids = [];
    }
  }

  const hasStartDateUpdate = start_date !== undefined;
  const hasEndDateUpdate = end_date !== undefined;
  
  if (hasStartDateUpdate || hasEndDateUpdate) {
    if (hasStartDateUpdate && !hasEndDateUpdate) {
      return responseBadRequest(res, t("both_start_and_end_date_required"));
    }
    if (hasEndDateUpdate && !hasStartDateUpdate) {
      return responseBadRequest(res, t("both_start_and_end_date_required"));
    }
    
    const hasStartDate = start_date !== null && start_date !== "";
    const hasEndDate = end_date !== null && end_date !== "";
    
    if ((hasStartDate && !hasEndDate) || (!hasStartDate && hasEndDate)) {
      return responseBadRequest(res, t("both_start_and_end_date_required"));
    }
    
    if (hasStartDate && hasEndDate) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      if (isNaN(startDate.getTime())) {
        return responseBadRequest(res, t("invalid_start_date"));
      }
      if (isNaN(endDate.getTime())) {
        return responseBadRequest(res, t("invalid_end_date"));
      }
      
      if (startDate > endDate) {
        return responseBadRequest(res, t("start_date_must_be_before_end_date"));
      }
      
      updateData.start_date = startDate;
      updateData.end_date = endDate;
    } else {
      updateData.start_date = null;
      updateData.end_date = null;
    }
  }

  const updated = await NoticeModel.findOneAndUpdate(
    { _id: noticeId },
    updateData,
    { new: true, runValidators: true }
  );

  if (!updated) {
    return responseBadRequest(res, t("notice_not_found"));
  }

  return responseSuccess(
    res,
    {
      id: updated._id.toString(),
      title: updated.title,
      content: updated.content,
      partner_ids: updated.partner_ids,
      start_date: updated.start_date,
      end_date: updated.end_date,
    },
    t("notice_updated_successfully")
  );
};
