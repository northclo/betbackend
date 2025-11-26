import PartnerMessageModel from "../../../models/PartnerMessage.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { messageType } from "../../../const/type.js";
import mongoose from "mongoose";

const getAllParentPartnerIds = async (partnerId) => {
  if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
    return [];
  }

  const partnerIds = [];
  let currentPartnerId = new mongoose.Types.ObjectId(partnerId);

  while (currentPartnerId) {
    partnerIds.push(currentPartnerId);
    
    const partner = await PartnerModel.findById(currentPartnerId)
      .select("parent_partner_id")
      .lean();
    
    if (!partner || !partner.parent_partner_id) {
      break;
    }
    
    currentPartnerId = partner.parent_partner_id;
  }

  return partnerIds;
};

const toNoticeDto = async (message) => {
  let writerName = t("admin");
  if (message.sender) {
    try {
      const partner = await PartnerModel.findById(message.sender).lean();
      if (partner) {
        writerName = partner.nickname;
      }
    } catch (error) {
      console.error(`Error fetching sender ${message.sender}:`, error);
    }
  }

  return {
    _id: message._id.toString(),
    id: message._id.toString(),
    title: message.title || "",
    writer: writerName || "",
    createdAt: message.createdAt ? new Date(message.createdAt).toISOString() : null,
    content: message.content || "",
  };
};

export const getNoticeList = async (req, res) => {
  try {
    const userId = req.session._id;

    if (!userId) {
      return responseUnAutherized(res);
    }

    let user = await UserModel.findById(userId).lean();
    let customerPartnerId = null;
    if (!user) {
      user = await PartnerModel.findById(userId).lean();
      customerPartnerId = user._id;
      if (!user) {
        return responseUnAutherized(res);
      }
    } else {
      customerPartnerId = user.ownpartner_id;
    }

    const { page = 1, limit = 10 } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    if (!customerPartnerId || !mongoose.Types.ObjectId.isValid(customerPartnerId)) {
      return responseSuccess(res, {
        notices: [],
        page: pageNumber,
        totalPages: 1,
        total: 0,
        limit: pageSize,
      });
    }

    const relevantPartnerIds = await getAllParentPartnerIds(customerPartnerId);

    const now = Date.now();
    const filter = {
      type: messageType.groupMessasge,
      receiver: { $in: relevantPartnerIds },
      $or: [
        { expire_at: null },
        { expire_at: { $exists: false } },
        { expire_at: { $gt: now } }
      ]
    };

    const [messages, total] = await Promise.all([
      PartnerMessageModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      PartnerMessageModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    const items = await Promise.all(messages.map((message) => toNoticeDto(message)));

    return responseSuccess(res, {
      notices: items,
      page: pageNumber,
      totalPages: totalPages,
      total: total,
      limit: pageSize,
    });
  } catch (error) {
    console.error("Error fetching notice list:", error);
    return responseServerError(res);
  }
};

