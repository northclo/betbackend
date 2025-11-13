import PopupModel from "../../../models/Popup.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";

const ensureAdminId = (req) => {
  const adminId = req?.session?._id;
  return typeof adminId === "string" && adminId.trim().length > 0 ? adminId : null;
};

export const deletePopup = async (req, res) => {
  const adminId = ensureAdminId(req);
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { popupId } = req.params;
  if (!popupId) {
    return responseBadRequest(res, "Popup id is required.");
  }

  // Admin can delete any popup (not restricted to their own)
  const deleted = await PopupModel.findOneAndDelete({ _id: popupId });

  if (!deleted) {
    return responseBadRequest(res, "Popup not found.");
  }

  return responseSuccess(res, null, "Popup deleted successfully.");
};

