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

export const createPopup = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const payload = normalizePayload(req.body || {});

    if (!payload.title || !payload.content) {
      return responseBadRequest(res, t("title_content_required"));
    }

    if (req.body.status !== undefined && payload.status === undefined) {
      return responseBadRequest(res, t("invalid_status_value"));
    }

    payload.author = adminId;

    if (!payload.status) {
      payload.status = "INACTIVE";
    }

    const created = await PopupModel.create(payload);

    const dto = await toPopupDto(created);
    if (!dto) {
      return responseBadRequest(res, t("failed_process_created_popup"));
    }

    return responseSuccess(
      res,
      dto,
      t("popup_created_successfully")
    );
  } catch (error) {
    console.error("Error to create popup:", error);
    return responseServerError(res);
  }
};

