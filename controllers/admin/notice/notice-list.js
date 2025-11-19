import NoticeModel from "../../../models/Notice.js";
import PartnerModel from "../../../models/Partner.js";
import UserModel from "../../../models/User.js";
import {
  responseBadRequest,
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
            const idString = String(partnerId).trim();
            
            if (mongoose.Types.ObjectId.isValid(idString)) {
              partner = await PartnerModel.findById(idString).lean();
            }
            
            if (!partner) {
              partner = await PartnerModel.findOne({ partner_id: idString }).lean();
            }
            
            if (partner) {
              partnerNames.push(partner.nickname || partner.partner_id || partner._id?.toString() || t("unknown"));
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
    if (notice.sender) {
      try {
        const user = await UserModel.findById(notice.sender).lean();
        if (user) {
          senderName = user.user_nickname || user.user_name || user.user_email || t("unknown");
        }
      } catch (error) {
        console.error(`Error fetching sender ${notice.sender}:`, error);
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
      start_date: notice.start_date ? new Date(notice.start_date).toISOString() : null,
      end_date: notice.end_date ? new Date(notice.end_date).toISOString() : null,
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
      start_date: notice?.start_date ? new Date(notice.start_date).toISOString() : null,
      end_date: notice?.end_date ? new Date(notice.end_date).toISOString() : null,
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
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    if (partnerId && partnerId.trim() !== "" && partnerId !== "all") {
      let normalizedPartnerId = partnerId.trim();
      if (!mongoose.Types.ObjectId.isValid(normalizedPartnerId)) {
        try {
          const partner = await PartnerModel.findOne({ partner_id: normalizedPartnerId }).lean();
          if (partner && partner._id) {
            normalizedPartnerId = partner._id.toString();
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
      }
      
      filter.$or = [
        { partner_ids: { $exists: false } },
        { partner_ids: { $size: 0 } },
        { partner_ids: null },
        { partner_ids: { $in: [normalizedPartnerId] } }
      ];
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      if (start > end) {
        return responseBadRequest(res, t("start_date_must_be_before_end_date"));
      }
    }

    if (startDate || endDate) {
      const dateConditions = [];
      
      if (startDate && endDate) {
        const filterStart = new Date(startDate);
        const filterEnd = new Date(endDate);
        filterStart.setHours(0, 0, 0, 0);
        filterEnd.setHours(23, 59, 59, 999);
        
        dateConditions.push({
          $or: [
            {
              $and: [
                {
                  $or: [
                    { start_date: null },
                    { start_date: { $exists: false } },
                    { start_date: { $lte: filterEnd } }
                  ]
                },
                {
                  $or: [
                    { end_date: null },
                    { end_date: { $exists: false } },
                    { end_date: { $gte: filterStart } }
                  ]
                }
              ]
            },
            {
              $and: [
                { $or: [{ start_date: null }, { start_date: { $exists: false } }] },
                { $or: [{ end_date: null }, { end_date: { $exists: false } }] },
                { createdAt: { $gte: filterStart, $lte: filterEnd } }
              ]
            }
          ]
        });
      } else if (startDate) {
        const filterStart = new Date(startDate);
        filterStart.setHours(0, 0, 0, 0);
        
        dateConditions.push({
          $or: [
            {
              $or: [
                { start_date: null },
                { start_date: { $exists: false } },
                { start_date: { $lte: filterStart } }
              ]
            },
            {
              $and: [
                { $or: [{ start_date: null }, { start_date: { $exists: false } }] },
                { $or: [{ end_date: null }, { end_date: { $exists: false } }] },
                { createdAt: { $lte: filterStart } }
              ]
            }
          ]
        });
      } else if (endDate) {
        const filterEnd = new Date(endDate);
        filterEnd.setHours(23, 59, 59, 999);
        
        dateConditions.push({
          $or: [
            {
              $or: [
                { end_date: null },
                { end_date: { $exists: false } },
                { end_date: { $gte: filterEnd } }
              ]
            },
            {
              $and: [
                { $or: [{ start_date: null }, { start_date: { $exists: false } }] },
                { $or: [{ end_date: null }, { end_date: { $exists: false } }] },
                { createdAt: { $gte: filterEnd } }
              ]
            }
          ]
        });
      }
      
      if (dateConditions.length > 0) {
        filter.$and = filter.$and || [];
        filter.$and.push(...dateConditions);
      }
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
