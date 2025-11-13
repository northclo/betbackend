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

export const viewPopup = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { popupId } = req.params;
  if (!popupId) {
    return responseBadRequest(res, "Popup id is required.");
  }

  const popup = await PopupModel.findById(popupId).lean();

  if (!popup) {
    return responseBadRequest(res, "Popup not found.");
  }

  const dto = await toPopupDto(popup);
  return responseSuccess(res, dto);
};

