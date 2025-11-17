import AnnouncementModel from "../../../models/Announcement.js";
import UserModel from "../../../models/User.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { getPresignedUrl } from "../../../utils/s3.js";
import { t } from "../../../helper/translation.js";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

const toAnnouncementDto = async (post) => {
  let imageUrl = post.image;
  
  if (imageUrl && !imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    imageUrl = await getPresignedUrl(imageUrl);
  }

  // Get author info
  let author = t("unknown");
  if (post.userId) {
    try {
      const user = await UserModel.findById(post.userId).lean();
      if (user) {
        author = user.user_nickname || user.user_name || user.user_email || t("unknown");
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
    slug: post.slug,
    image: imageUrl,
    category: post.category,
    status: post.status,
    published_at: post.published_at ? new Date(post.published_at).toISOString() : null,
    author: author,
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
  const adminId = ensureAdminId(req);
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

  const filter = {}; // Admin can see all announcements, not filtered by userId

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    filter.status = normalizedStatus;
  }

  if (category && String(category).trim().length > 0 && category !== "all") {
    filter.category = String(category).trim();
  }

  // Date range filter
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

  // Keyword search (title or description)
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
};

