import AnnouncementModel from "../../../models/Announcement.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import PartnerModel from "../../../models/Partner.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

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

export const updateAnnouncement = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);

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

    if (!accessiblePartnerIds.some(pid => pid.toString() === existing.author.toString())) {
      return responseBadRequest(res, t("announcement_not_found"));
    }

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

