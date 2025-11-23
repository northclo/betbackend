import PopupModel from "../../../models/Popup.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const deletePopup = async (req, res) => {
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

    const existing = await PopupModel.findById(popupId).lean();
    if (!existing) {
      return responseBadRequest(res, t("popup_not_found"));
    }

    if (!accessiblePartnerIdsString.includes(existing.author)) {
      return responseBadRequest(res, t("popup_not_found"));
    }

    const deleted = await PopupModel.findOneAndDelete({ _id: popupId });

    if (!deleted) {
      return responseBadRequest(res, t("popup_not_found"));
    }

    return responseSuccess(res, null, t("popup_deleted_successfully"));
  } catch (error) {
    console.error("Error to delete popup:", error);
    return responseServerError(res);
  }
};

