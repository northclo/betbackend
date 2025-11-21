import PopupModel from "../../../models/Popup.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import {
  toPopupDto,
  normalizePayload,
} from "./popup-utils.js";
import { t } from "../../../helper/translation.js";

export const updatePopup = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { popupId } = req.params;
    if (!popupId) {
      return responseBadRequest(res, t("popup_id_required"));
    }

    const payload = normalizePayload(req.body || {});

    if (req.body.status !== undefined && payload.status === undefined) {
      return responseBadRequest(res, t("invalid_status_value"));
    }

    if (payload.title !== undefined && !payload.title) {
      return responseBadRequest(res, t("title_cannot_empty"));
    }

    if (payload.content !== undefined && !payload.content) {
      return responseBadRequest(res, t("content_cannot_empty"));
    }

    const existing = await PopupModel.findById(popupId).lean();
    if (!existing) {
      return responseBadRequest(res, t("popup_not_found"));
    }

    const updated = await PopupModel.findOneAndUpdate(
      { _id: popupId },
      payload,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return responseBadRequest(res, t("popup_not_found_or_update_failed"));
    }

    const dto = await toPopupDto(updated);
    if (!dto) {
      return responseBadRequest(res, t("failed_process_updated_popup"));
    }

    return responseSuccess(
      res,
      dto,
      t("popup_updated_successfully")
    );
  } catch (error) {
    console.error("Error to update popup:", error);
    return responseServerError(res);
  }
};

