import AnnouncementModel from "../../../models/Announcement.js";
import PartnerModel from "../../../models/Partner.js";
import {
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";

const toAnnouncementDto = async (post) => {
  let author = "-";
  if (post.author) {
    try {
      const partner = await PartnerModel.findById(post.author).lean();
      if (partner) {
        author = partner.nickname;
      }
    } catch (error) {
      console.error("Error fetching author:", error);
    }
  }

  return {
    id: post._id.toString(),
    _id: post._id.toString(),
    title: post.title,
    description: post.description,
    category: post.category,
    status: post.status,
    author: author,
    date: post.createdAt ? new Date(post.createdAt).toISOString() : null,
    createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : null,
    updatedAt: post.updatedAt ? new Date(post.updatedAt).toISOString() : null,
  };
};

const normalizeStatus = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!["draft", "published", "archived", "hidden"].includes(normalized)) {
    return undefined;
  }

  return normalized;
};

export const listAnnouncements = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { 
      status, 
      category, 
      keyword,
      startDate,
      endDate,
      page = 1, 
      limit = 10 
    } = req.query;

    const filter = {};

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus) {
      filter.status = normalizedStatus;
    }

    if (category && String(category).trim().length > 0 && category !== "all") {
      const normalizedCategory = String(category).trim();
      if (["system_notice", "maintenance", "event"].includes(normalizedCategory)) {
        filter.category = normalizedCategory;
      }
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (keyword && String(keyword).trim().length > 0) {
      const keywordRegex = new RegExp(String(keyword).trim(), "i");
      filter.$or = [
        { title: keywordRegex },
        { description: keywordRegex },
      ];
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const [posts, total] = await Promise.all([
      AnnouncementModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      AnnouncementModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    const items = await Promise.all(posts.map((post) => toAnnouncementDto(post)));

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
    console.error("Error to list announcements:", error);
    return responseServerError(res);
  }
};

