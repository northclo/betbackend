import BlogPostModel from "../../../models/BlogPost.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { getPresignedUrl } from "../../../utils/s3.js";

const toBlogPostDto = async (post) => {
  let imageUrl = post.image;
  
  if (imageUrl && !imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    imageUrl = await getPresignedUrl(imageUrl);
  }

  return {
    _id: post._id,
    title: post.title,
    description: post.description,
    slug: post.slug,
    image: imageUrl,
    userId: post.userId,
    category: post.category,
    status: post.status,
    published_at: post.published_at,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

const ensureUserId = (req) => {
  const userId = req?.session?._id;
  return typeof userId === "string" && userId.trim().length > 0 ? userId : null;
};

const normalizeStatus = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!["draft", "published", "archived"].includes(normalized)) {
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
    if (!isNaN(published)) {
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
  const baseSlug = slugify(title) || `post-${Date.now()}`;
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

export const listBlogPosts = async (req, res) => {
  const userId = ensureUserId(req);
  if (!userId) {
    return responseUnAutherized(res);
  }

  const { status, category, page = 1, limit = 10 } = req.query;

  const filter = { userId };

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    filter.status = normalizedStatus;
  }

  if (category && String(category).trim().length > 0) {
    filter.category = String(category).trim();
  }

  const pageNumber = Number(page) || 1;
  const pageSize = Math.min(Number(limit) || 10);
  const skip = (pageNumber - 1) * pageSize;

  const [posts, total] = await Promise.all([
    BlogPostModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    BlogPostModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const items = await Promise.all(posts.map((post) => toBlogPostDto(post)));

  return responseSuccess(res, {
    items,
    page: pageNumber,
    limit: pageSize,
    total,
    totalPages,
  });
};

export const createBlogPost = async (req, res) => {
  const userId = ensureUserId(req);
  if (!userId) {
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

  payload.userId = userId;

  if (!payload.category) {
    payload.category = "General";
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

  const dto = await toBlogPostDto(created);
  return responseSuccess(
    res,
    dto,
    "Blog post created successfully."
  );
};

export const updateBlogPost = async (req, res) => {
  const userId = ensureUserId(req);
  if (!userId) {
    return responseUnAutherized(res);
  }

  const { postId } = req.params;
  if (!postId) {
    return responseBadRequest(res, "Post id is required.");
  }

  const payload = normalizePayload(req.body || {});

  if (req.file) {
    payload.image = req.file.path;
  }

  if (payload.title !== undefined && !payload.title) {
    return responseBadRequest(res, "Title cannot be empty.");
  }

  if (payload.description !== undefined && !payload.description) {
    return responseBadRequest(res, "Description cannot be empty.");
  }

  if (payload.status && payload.status === "published" && !payload.published_at) {
    payload.published_at = new Date();
  }

  if (payload.status && payload.status !== "published" && payload.published_at === undefined) {
    payload.published_at = null;
  }

  if (payload.title) {
    payload.slug = await generateUniqueSlug(payload.title, postId);
  }

  const updated = await BlogPostModel.findOneAndUpdate(
    { _id: postId, userId },
    payload,
    { new: true, runValidators: true }
  );

  if (!updated) {
    return responseBadRequest(res, "Blog post not found.");
  }

  const dto = await toBlogPostDto(updated);
  return responseSuccess(
    res,
    dto,
    "Blog post updated successfully."
  );
};

export const deleteBlogPost = async (req, res) => {
  const userId = ensureUserId(req);
  if (!userId) {
    return responseUnAutherized(res);
  }

  const { postId } = req.params;
  if (!postId) {
    return responseBadRequest(res, "Post id is required.");
  }

  const deleted = await BlogPostModel.findOneAndDelete({ _id: postId, userId });

  if (!deleted) {
    return responseBadRequest(res, "Blog post not found.");
  }

  return responseSuccess(res, null, "Blog post deleted successfully.");
};
