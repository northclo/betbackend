import PopupModel from "../../../models/Popup.js";
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

const normalizePayload = (payload) => {
  const normalized = {};

  if (payload.title !== undefined) {
    normalized.title = String(payload.title || "").trim();
  }

  if (payload.content !== undefined) {
    normalized.content = String(payload.content || "").trim();
  }

  if (payload.image !== undefined) {
    const image = String(payload.image || "").trim();
    normalized.image = image.length ? image : null;
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

  if (payload.position !== undefined) {
    const position = String(payload.position || "center").trim().toLowerCase();
    if (["top", "center", "bottom", "fullscreen"].includes(position)) {
      normalized.position = position;
    }
  }

  if (payload.size !== undefined) {
    const size = String(payload.size || "medium").trim().toLowerCase();
    if (["small", "medium", "large", "fullscreen"].includes(size)) {
      normalized.size = size;
    }
  }

  if (payload.link_url !== undefined) {
    const linkUrl = String(payload.link_url || "").trim();
    normalized.link_url = linkUrl.length ? linkUrl : null;
  }

  if (payload.is_closable !== undefined) {
    normalized.is_closable = Boolean(payload.is_closable);
  }

  return normalized;
};

export const updatePopup = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { popupId } = req.params;
  if (!popupId) {
    return responseBadRequest(res, "Popup id is required.");
  }

  const payload = normalizePayload(req.body || {});

  if (req.file) {
    payload.image = req.file.path;
  }

  if (payload.title !== undefined && !payload.title) {
    return responseBadRequest(res, "Title cannot be empty.");
  }

  if (payload.content !== undefined && !payload.content) {
    return responseBadRequest(res, "Content cannot be empty.");
  }

  // Validate date range if both dates are provided
  if (payload.start_date && payload.end_date) {
    if (new Date(payload.start_date) > new Date(payload.end_date)) {
      return responseBadRequest(res, "Start date must be before end date.");
    }
  }

  // If updating dates, check against existing dates
  const existing = await PopupModel.findById(popupId).lean();
  if (existing) {
    const startDate = payload.start_date !== undefined ? payload.start_date : existing.start_date;
    const endDate = payload.end_date !== undefined ? payload.end_date : existing.end_date;
    
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return responseBadRequest(res, "Start date must be before end date.");
    }
  }

  // Admin can update any popup (not restricted to their own)
  const updated = await PopupModel.findOneAndUpdate(
    { _id: popupId },
    payload,
    { new: true, runValidators: true }
  );

  if (!updated) {
    return responseBadRequest(res, "Popup not found.");
  }

  const dto = await toPopupDto(updated);
  return responseSuccess(
    res,
    dto,
    "Popup updated successfully."
  );
};

