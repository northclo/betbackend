import NoticeModel from "../../../models/Notice.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

// Get all sub partner IDs for the current logged in partner
const getSubPartnerIds = async (userId) => {
  const results = await PartnerModel.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
      }
    },
    {
      $graphLookup: {
        from: 'partners',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent_partner_id',
        as: 'subs'
      }
    },
  ]);

  if (!results.length) return [];

  const root = results[0];
  const allPartnerIds = [
    root._id.toString(),
    ...(root.subs || []).map(sub => sub._id.toString())
  ];

  return allPartnerIds;
};

const normalizePartnerIds = async (partnerIds) => {
  if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
    return [];
  }

  const normalizedIds = [];
  for (const partnerId of partnerIds) {
    if (!partnerId) continue;
    
    const idString = String(partnerId).trim();
    
    if (mongoose.Types.ObjectId.isValid(idString)) {
      normalizedIds.push(idString);
    } else {
      try {
        const partner = await PartnerModel.findOne({ partner_id: idString }).lean();
        if (partner && partner._id) {
          normalizedIds.push(partner._id.toString());
        }
      } catch (error) {
        console.error(`Error normalizing partner ID ${idString}:`, error);
      }
    }
  }

  return normalizedIds;
};

export const updateNotice = async (req, res) => {
  const adminId = ensureAdminId(req);
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

  if (start_date !== undefined) {
    if (start_date === null || start_date === "") {
      updateData.start_date = null;
    } else {
      const startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return responseBadRequest(res, t("invalid_start_date"));
      }
      updateData.start_date = startDate;
    }
  }

  if (end_date !== undefined) {
    if (end_date === null || end_date === "") {
      updateData.end_date = null;
    } else {
      const endDate = new Date(end_date);
      if (isNaN(endDate.getTime())) {
        return responseBadRequest(res, t("invalid_end_date"));
      }
      updateData.end_date = endDate;
    }
  }

  const finalStartDate = updateData.start_date !== undefined ? updateData.start_date : existingNotice.start_date;
  const finalEndDate = updateData.end_date !== undefined ? updateData.end_date : existingNotice.end_date;
  
  if (finalStartDate && finalEndDate) {
    const start = new Date(finalStartDate);
    const end = new Date(finalEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return responseBadRequest(res, t("invalid_date_range"));
    }
    if (start > end) {
      return responseBadRequest(res, t("start_date_must_be_before_end_date"));
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
