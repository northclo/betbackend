import NoticeModel from "../../../models/Notice.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

const toNoticeDto = async (notice) => {
  let writerName = t("admin");
  if (notice.writer) {
    try {
      const partner = await PartnerModel.findById(notice.writer).lean();
      if (partner) {
        writerName = partner.nickname;
      }
    } catch (error) {
      console.error(`Error fetching writer ${notice.writer}:`, error);
    }
  }

  return {
    _id: notice._id.toString(),
    id: notice._id.toString(),
    title: notice.title || "",
    writer: writerName || "",
    createdAt: notice.createdAt ? new Date(notice.createdAt).toISOString() : null,
    content: notice.content || "",
  };
};

export const getNoticeList = async (req, res) => {
  try {
    const userId = req.session._id;

    if (!userId) {
      return responseUnAutherized(res);
    }

    const user = await UserModel.findById(userId).lean();
    if (!user) {
      return responseUnAutherized(res);
    }

    const { page = 1, limit = 10 } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const filter = {
      $or: [
        { partner_ids: { $exists: false } },
        { partner_ids: { $size: 0 } },
        { partner_ids: null },
      ]
    };

    if (user.partner_id) {
      filter.$or.push({
        partner_ids: { $in: [user.partner_id] }
      });
    }

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

