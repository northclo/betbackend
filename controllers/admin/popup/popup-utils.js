import PartnerModel from "../../../models/Partner.js";
import { t } from "../../../helper/translation.js";

export const toPopupDto = async (popup) => {
  if (!popup) {
    return null;
  }

  let author = t("unknown");
  if (popup.author) {
    try {
      const partner = await PartnerModel.findById(popup.author).lean();
      if (partner) {
        author = partner.nickname || t("unknown");
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
    status: popup.status,
    author: author,
    createdAt: popup.createdAt ? new Date(popup.createdAt).toISOString() : null,
    updatedAt: popup.updatedAt ? new Date(popup.updatedAt).toISOString() : null,
    date: popup.createdAt ? new Date(popup.createdAt).toISOString() : null,
  };
};

export const normalizeStatus = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toUpperCase();
  if (!["ACTIVE", "INACTIVE"].includes(normalized)) {
    return undefined;
  }

  return normalized;
};

export const normalizePayload = (payload) => {
  const normalized = {};

  if (payload.title !== undefined) {
    normalized.title = String(payload.title || "").trim();
  }

  if (payload.content !== undefined) {
    normalized.content = String(payload.content || "").trim();
  }

  if (payload.status !== undefined) {
    normalized.status = normalizeStatus(payload.status);
  }

  return normalized;
};

