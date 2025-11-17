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

const normalizePartnerIdsArray = async (partnerIds) => {
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

export const deleteNotice = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { noticeId } = req.params;
  if (!noticeId) {
    return responseBadRequest(res, t("notice_id_required"));
  }

  // Get allowed partner IDs
  const allowedPartnerIds = await getSubPartnerIds(adminId);

  const notice = await NoticeModel.findById(noticeId).lean();
  
  if (!notice) {
    return responseBadRequest(res, t("notice_not_found"));
  }

  let hasAccess = false;
  
  if (!notice.partner_ids || notice.partner_ids.length === 0) { 
    hasAccess = notice.sender && notice.sender.toString() === adminId;
  } else {
    const normalizedNoticePartnerIds = await normalizePartnerIdsArray(notice.partner_ids);
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

