import PopupModel from "../../../models/Popup.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import {
  toPopupDto,
} from "./popup-utils.js";
import { t } from "../../../helper/translation.js";

export const viewPopup = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { popupId } = req.params;
    if (!popupId) {
      return responseBadRequest(res, t("popup_id_required"));
    }

    const popup = await PopupModel.findById(popupId).lean();

    if (!popup) {
      return responseBadRequest(res, t("popup_not_found"));
    }

    const dto = await toPopupDto(popup);
    if (!dto) {
      return responseBadRequest(res, t("failed_process_popup_data"));
    }

    return responseSuccess(res, dto);
  } catch (error) {
    console.error("Error to view popup:", error);
    return responseServerError(res);
  }
};

