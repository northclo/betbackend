import PopupModel from "../../../models/Popup.js";
import UserModel from "../../../models/User.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { getPresignedUrl } from "../../../utils/s3.js";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

const toPopupDto = async (popup) => {
  let imageUrl = popup.image;
  
  if (imageUrl && !imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    imageUrl = await getPresignedUrl(imageUrl);
  }

  // Get author info
  let author = "Unknown";
  if (popup.userId) {
    try {
      const user = await UserModel.findById(popup.userId).lean();
      if (user) {
        author = user.user_nickname || user.user_name || user.user_email || "Unknown";
      }
    } catch (error) {
      console.error("Error fetching author:", error);
    }
  }

  return {
    id: popup._id.toString(),
    _id: popup._id.toString(),
    title: popup.title,
    content: popup.content,
    image: imageUrl,
    status: popup.status,
    start_date: popup.start_date ? new Date(popup.start_date).toISOString() : null,
    end_date: popup.end_date ? new Date(popup.end_date).toISOString() : null,
    display_order: popup.display_order || 0,
    position: popup.position || "center",
    size: popup.size || "medium",
    link_url: popup.link_url || null,
    is_closable: popup.is_closable !== undefined ? popup.is_closable : true,
    click_count: popup.click_count || 0,
    view_count: popup.view_count || 0,
    author: author,
    createdAt: popup.createdAt ? new Date(popup.createdAt).toISOString() : null,
    updatedAt: popup.updatedAt ? new Date(popup.updatedAt).toISOString() : null,
  };
};

const normalizeStatus = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!["active", "inactive"].includes(normalized)) {
    return undefined;
  }

  return normalized;
};

export const listPopups = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { 
    status, 
    keyword,
    startDate,
    endDate,
    page = 1, 
    limit = 10 
  } = req.query;

  const filter = {}; // Admin can see all popups

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    filter.status = normalizedStatus;
  }

  // Date range filter (based on start_date)
  if (startDate || endDate) {
    filter.start_date = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.start_date.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.start_date.$lte = end;
    }
  }

  // Keyword search (title or content)
  if (keyword && String(keyword).trim().length > 0) {
    const keywordRegex = new RegExp(String(keyword).trim(), "i");
    filter.$or = [
      { title: keywordRegex },
      { content: keywordRegex },
    ];
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [popups, total] = await Promise.all([
    PopupModel.find(filter)
      .sort({ display_order: 1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    PopupModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const items = await Promise.all(popups.map((popup) => toPopupDto(popup)));

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

