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

export const createNotice = async (req, res) => {
  const adminId = ensureAdminId(req);
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
