import NoticeModel from "../../../models/Notice.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";

const toNoticeDto = async (notice) => {
  try {
    let partnerDisplay = t("all_partners");
    
    if (notice.partner_ids && Array.isArray(notice.partner_ids) && notice.partner_ids.length > 0) {
      try {
        const partnerNames = [];
        for (const partnerId of notice.partner_ids) {
          if (!partnerId) continue;
          
          try {
            let partner = null;
            
            if (partnerId instanceof mongoose.Types.ObjectId || mongoose.Types.ObjectId.isValid(partnerId)) {
              partner = await PartnerModel.findById(partnerId).lean();
            }
            
            if (!partner) {
              const idString = String(partnerId).trim();
              if (mongoose.Types.ObjectId.isValid(idString)) {
                partner = await PartnerModel.findById(idString).lean();
              }
              if (!partner) {
                partner = await PartnerModel.findOne({ partner_id: idString }).lean();
              }
            }
            
            if (partner) {
              partnerNames.push(partner.nickname|| t("unknown"));
            }
          } catch (partnerError) {
            console.error(`Error fetching partner ${partnerId}:`, partnerError);
          }
        }
        partnerDisplay = partnerNames.length > 0 ? partnerNames.join(", ") : t("all_partners");
      } catch (error) {
        console.error("Error processing partner IDs:", error);
      }
    }

    let senderName = t("unknown");
    if (notice.writer) {
      try {
        const partner = await PartnerModel.findById(notice.writer).lean();
        if (partner) {
          senderName = partner.nickname || t("unknown");
        }
      } catch (error) {
        console.error(`Error fetching writer ${notice.writer}:`, error);
      }
    }

    return {
      id: notice._id.toString(),
      _id: notice._id.toString(),
      title: notice.title,
      content: notice.content,
      partner_ids: notice.partner_ids || [],
      partner: partnerDisplay,
      sender: senderName,
      createdAt: notice.createdAt ? new Date(notice.createdAt).toISOString() : null,
      updatedAt: notice.updatedAt ? new Date(notice.updatedAt).toISOString() : null,
      date: notice.createdAt ? new Date(notice.createdAt).toISOString() : null,
    };
  } catch (error) {
    console.error("Error to convert notice to dto:", error);
    return {
      id: notice?._id?.toString() || "",
      _id: notice?._id?.toString() || "",
      title: notice?.title || "",
      content: notice?.content || "",
      partner_ids: notice?.partner_ids || [],
      partner: t("all_partners"),
      sender: t("unknown"),
      createdAt: notice?.createdAt ? new Date(notice.createdAt).toISOString() : null,
      updatedAt: notice?.updatedAt ? new Date(notice.updatedAt).toISOString() : null,
      date: notice?.createdAt ? new Date(notice.createdAt).toISOString() : null,
    };
  }
};

export const listNotices = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const {
      searchType = "title",
      keyword = "",
      partnerId = "",
      startDate = "",
      endDate = "",
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    if (startDate && startDate.trim() !== "" || endDate && endDate.trim() !== "") {
      filter.createdAt = {};
      if (startDate && startDate.trim() !== "") {
        const start = new Date(startDate.trim());
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate && endDate.trim() !== "") {
        const end = new Date(endDate.trim());
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (partnerId && partnerId.trim() !== "" && partnerId !== "all") {
      let normalizedPartnerId = null;
      const partnerIdString = partnerId.trim();
      
      if (mongoose.Types.ObjectId.isValid(partnerIdString)) {
        normalizedPartnerId = new mongoose.Types.ObjectId(partnerIdString);
      } else {
        try {
          const partner = await PartnerModel.findOne({ partner_id: partnerIdString }).lean();
          if (partner && partner._id) {
            normalizedPartnerId = partner._id;
          } else {
            return responseSuccess(res, {
              list: [],
              items: [],
              page: 1,
              pageSize: limit,
              limit: limit,
              total: 0,
              totalPages: 0,
            });
          }
        } catch (error) {
          console.error("Error normalizing partner filter:", error);
          return responseServerError(res);
        }
      }
      
      filter.$or = [
        { partner_ids: { $exists: false } },
        { partner_ids: { $size: 0 } },
        { partner_ids: null },
        { partner_ids: { $in: [normalizedPartnerId] } }
      ];
    }

    if (keyword && String(keyword).trim().length > 0) {
      const keywordRegex = new RegExp(String(keyword).trim(), "i");
      if (searchType === "title") {
        filter.title = keywordRegex;
      } else if (searchType === "content") {
        filter.content = keywordRegex;
      } else {
        const searchOr = [
          { title: keywordRegex },
          { content: keywordRegex }
        ];
        
        if (filter.$or) {
          filter.$and = filter.$and || [];
          filter.$and.push({ $or: filter.$or });
          filter.$and.push({ $or: searchOr });
          delete filter.$or;
        } else {
          filter.$or = searchOr;
        }
      }
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const [notices, total] = await Promise.all([
      NoticeModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      NoticeModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    const items = await Promise.all(notices.map((notice) => toNoticeDto(notice)));

    return responseSuccess(res, {
      list: items,
      items: items,
      page: pageNumber,
      pageSize: pageSize,
      limit: pageSize,
      total,
      totalPages,
    });
  } catch (error) {
    console.error("Error to list notices:", error);
    return responseServerError(res);
  }
};
