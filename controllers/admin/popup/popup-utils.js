import PartnerModel from "../../../models/Partner.js";
import { t } from "../../../helper/translation.js";

export const toPopupDto = async (popup) => {
  if (!popup) {
    return null;
  }

  let author = t("unknown");
  if (popup.userId) {
    try {
      const partner = await PartnerModel.findById(popup.userId).lean();
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
    start_date: popup.start_date ? new Date(popup.start_date).toISOString() : null,
    end_date: popup.end_date ? new Date(popup.end_date).toISOString() : null,
    display_order: popup.display_order || 0,
    is_closable: popup.is_closable !== undefined ? popup.is_closable : true,
    click_count: popup.click_count || 0,
    view_count: popup.view_count || 0,
    author: author,
    createdAt: popup.createdAt ? new Date(popup.createdAt).toISOString() : null,
    updatedAt: popup.updatedAt ? new Date(popup.updatedAt).toISOString() : null,
  };
};

export const normalizeStatus = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!["active", "inactive"].includes(normalized)) {
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

  if (payload.start_date !== undefined && payload.start_date !== null) {
    const startDate = new Date(payload.start_date);
    if (!isNaN(startDate.getTime())) {
      normalized.start_date = startDate;
    }
  } else if (payload.start_date === null) {
    normalized.start_date = null;
  }

  if (payload.end_date !== undefined && payload.end_date !== null) {
    const endDate = new Date(payload.end_date);
    if (!isNaN(endDate.getTime())) {
      normalized.end_date = endDate;
    }
  } else if (payload.end_date === null) {
    normalized.end_date = null;
  }

  if (payload.display_order !== undefined) {
    normalized.display_order = Math.max(0, Number(payload.display_order) || 0);
  }

  if (payload.is_closable !== undefined) {
    normalized.is_closable = Boolean(payload.is_closable);
  }

  return normalized;
};

