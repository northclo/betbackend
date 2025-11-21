import NoticeModel from "../../../models/Notice.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { normalizePartnerIds } from "./notice-utils.js";

export const createNotice = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { title, content, partnerIds } = req.body;

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
      
      partner_ids = normalizedIds;
    }

    const notice = await NoticeModel.create({
      partner_ids: partner_ids,
      writer: adminId,
      title: title.trim(),
      content: content.trim(),
    });

    return responseSuccess(
      res,
      {
        id: notice._id.toString(),
        title: notice.title,
        content: notice.content,
        partner_ids: notice.partner_ids,
      },
      t("notice_created_successfully")
    );
  } catch (error) {
    console.error("Error to create notice:", error);
    return responseServerError(res);
  }
};
