import AnnouncementModel from "../../../models/Announcement.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import PartnerModel from "../../../models/Partner.js";
import { t } from "../../../helper/translation.js";

const toAnnouncementDto = async (post) => {
  let author = t("unknown");
  if (post.userId) {
    try {
      const partner = await PartnerModel.findById(post.userId).lean();
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
    slug: post.slug,
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

  while (await AnnouncementModel.exists(query(slug))) {
    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
};

export const updateAnnouncement = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { announcementId } = req.params;
    if (!announcementId) {
      return responseBadRequest(res, t("announcement_id_required"));
    }

    const payload = normalizePayload(req.body || {});

    if (payload.category && !["system_notice", "maintenance", "event"].includes(payload.category)) {
      return responseBadRequest(res, t("invalid_category"));
    }

    if (payload.title !== undefined && !payload.title) {
      return responseBadRequest(res, t("title_cannot_empty"));
    }

    if (payload.description !== undefined && !payload.description) {
      return responseBadRequest(res, t("description_cannot_empty"));
    }

    const existing = await AnnouncementModel.findById(announcementId).lean();
    if (!existing) {
      return responseBadRequest(res, t("announcement_not_found"));
    }

    if (payload.status !== undefined) {
      if (payload.status === "published") {
        if (!payload.published_at && !existing.published_at) {
          payload.published_at = new Date();
        } else if (!payload.published_at) {
          payload.published_at = existing.published_at;
        }
      } else {
        if (existing.status === "published") {
          payload.published_at = null;
        }
      }
    } else if (existing.status === "published" && payload.published_at === undefined) {
      payload.published_at = existing.published_at;
    }

    if (payload.title) {
      payload.slug = await generateUniqueSlug(payload.title, announcementId);
    }

    // Admin can update any announcement (not restricted to their own)
    const updated = await AnnouncementModel.findOneAndUpdate(
      { _id: announcementId },
      payload,
      { new: true, runValidators: true }
    );

    const dto = await toAnnouncementDto(updated);
    return responseSuccess(
      res,
      dto,
      t("announcement_updated_successfully")
    );
  } catch (error) {
    console.error("Error to update an announcement:", error);
    return responseServerError(res);
  }
};

