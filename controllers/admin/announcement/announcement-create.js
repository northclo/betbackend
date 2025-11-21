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

  return normalized;
};

export const createAnnouncement = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const payload = normalizePayload(req.body || {});

    if (!payload.title || !payload.description) {
      return responseBadRequest(res, t("title_description_required"));
    }

    if (payload.category && !["system_notice", "maintenance", "event"].includes(payload.category)) {
      return responseBadRequest(res, t("invalid_category"));
    }

    payload.author = adminId;

    if (!payload.category) {
      payload.category = "system_notice";
    }

    if (!payload.status) {
      payload.status = "draft";
    }

    const created = await AnnouncementModel.create(payload);

    const dto = await toAnnouncementDto(created);
    return responseSuccess(
      res,
      dto,
      t("announcement_created_successfully")
    );
  } catch (error) {
    console.error("Error to create a new announcement:", error);
    return responseServerError(res);
  }
};

