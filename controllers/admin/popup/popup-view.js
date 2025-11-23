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
import { fetchAccessiblePartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const viewPopup = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessiblePartnerIdsString = accessiblePartnerIds.map(id => id.toString());

    const { popupId } = req.params;
    if (!popupId) {
      return responseBadRequest(res, t("popup_id_required"));
    }

    const popup = await PopupModel.findById(popupId).lean();

    if (!popup) {
      return responseBadRequest(res, t("popup_not_found"));
    }

    if (!accessiblePartnerIdsString.includes(popup.author)) {
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

