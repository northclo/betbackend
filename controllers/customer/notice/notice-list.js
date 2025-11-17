import NoticeModel from "../../../models/Notice.js";
import UserModel from "../../../models/User.js";
import {
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

const toNoticeDto = async (notice) => {
  let writerName = t("admin");
  if (notice.sender) {
    try {
      const user = await UserModel.findById(notice.sender).lean();
      if (user) {
        writerName = user.user_nickname || t("admin");
      }
    } catch (error) {
      console.error(`Error fetching sender ${notice.sender}:`, error);
    }
  }

  return {
    _id: notice._id.toString(),
    id: notice._id.toString(),
    title: notice.title || "",
    writer: writerName || "",
    createdAt: notice.createdAt ? new Date(notice.createdAt).toISOString() : null,
    content: notice.content || "",
    start_date: notice.start_date ? new Date(notice.start_date).toISOString() : null,
    end_date: notice.end_date ? new Date(notice.end_date).toISOString() : null
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

    const [notices, total] = await Promise.all([
      NoticeModel.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      NoticeModel.countDocuments({}),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    const items = await Promise.all(notices.map((notice) => toNoticeDto(notice)));

    const noticesWithIndex = items.map((item, index) => ({
      ...item,
      index: (pageNumber - 1) * pageSize + index + 1,
    }));

    return responseSuccess(res, {
      notices: noticesWithIndex,
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

