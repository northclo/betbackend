import PopupModel from "../../../models/Popup.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const deletePopup = async (req, res) => {
  const adminId = req?.session?._id;
  if (!adminId) {
    return responseUnAutherized(res);
  }

  const { popupId } = req.params;
  if (!popupId) {
    return responseBadRequest(res, t("popup_id_required"));
  }

  const deleted = await PopupModel.findOneAndDelete({ _id: popupId });

  if (!deleted) {
    return responseBadRequest(res, t("popup_not_found"));
  }

  return responseSuccess(res, null, t("popup_deleted_successfully"));
};

