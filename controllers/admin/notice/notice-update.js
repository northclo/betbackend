import NoticeModel from "../../../models/Notice.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { normalizePartnerIds } from "./notice-utils.js";
import { fetchAccessiblePartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const updateNotice = async (req, res) => {
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

    const { title, content, partnerIds } = req.body;

    const existingNotice = await NoticeModel.findById(noticeId).lean();
    
    if (!existingNotice) {
      return responseBadRequest(res, t("notice_not_found"));
    }

    if (!accessiblePartnerIds.some(pid => pid.toString() === existingNotice.writer.toString())) {
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

        const accessibleNormalizedIds = normalizedIds.filter(id => 
          accessiblePartnerIds.some(pid => pid.toString() === id.toString())
        );
        
        updateData.partner_ids = accessibleNormalizedIds;
      } else {
        updateData.partner_ids = [];
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
      },
      t("notice_updated_successfully")
    );
  } catch (error) {
    console.error("Error to update notice:", error);
    return responseServerError(res);
  }
};
