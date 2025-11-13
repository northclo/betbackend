import BlogPostModel from "../../../models/BlogPost.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { getPresignedUrl } from "../../../utils/s3.js";
import UserModel from "../../../models/User.js";

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
  let author = "Unknown";
  if (post.userId) {
    try {
      const user = await UserModel.findById(post.userId).lean();
      if (user) {
        author = user.user_nickname || user.user_name || user.user_email || "Unknown";
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

const normalizePayload = (payload) => {
  const normalized = {};

  if (payload.title !== undefined) {
    normalized.title = String(payload.title || "").trim();
  }

  if (payload.description !== undefined) {
    normalized.description = String(payload.description || "").trim();
  }

  if (payload.image !== undefined) {
    const image = String(payload.image || "").trim();
    normalized.image = image.length ? image : null;
  }

  if (payload.category !== undefined) {
    normalized.category = String(payload.category || "").trim();
  }

  if (payload.status !== undefined) {
    normalized.status = normalizeStatus(payload.status);
  }

  if (payload.published_at !== undefined && payload.published_at !== null) {
    const published = new Date(payload.published_at);
    if (!isNaN(published.getTime())) {
      normalized.published_at = published;
    }
  } else if (payload.published_at === null) {
    normalized.published_at = null;
  }

  return normalized;
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateUniqueSlug = async (title, excludeId = null) => {
  const baseSlug = slugify(title) || `announcement-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;

  const query = (candidate) => {
    const filter = { slug: candidate };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return filter;
  };

  while (await BlogPostModel.exists(query(slug))) {
    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
};

export const createAnnouncement = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const payload = normalizePayload(req.body || {});

  if (!payload.title || !payload.description) {
    return responseBadRequest(res, "Title and description are required.");
  }

  if (req.file) {
    payload.image = req.file.path;
  } else if (payload.image === undefined) {
    payload.image = null;
  }

  payload.userId = adminId; // Store which admin created it

  if (!payload.category) {
    payload.category = "system_notice"; // Default category
  }

  if (!payload.status) {
    payload.status = "draft";
  }

  if (payload.status === "published" && !payload.published_at) {
    payload.published_at = new Date();
  }

  if (payload.status !== "published") {
    payload.published_at = null;
  }

  payload.slug = await generateUniqueSlug(payload.title);

  const created = await BlogPostModel.create(payload);

  const dto = await toAnnouncementDto(created);
  return responseSuccess(
    res,
    dto,
    "Announcement created successfully."
  );
};

