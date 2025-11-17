import PopupModel from "../../../models/Popup.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
} from "../../../helper/response.js";
import {
  ensureAdminId,
  toPopupDto,
  normalizePayload,
} from "./popup-utils.js";
import { t } from "../../../helper/translation.js";

export const createPopup = async (req, res) => {
  const adminId = ensureAdminId(req);
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

  payload.userId = adminId; // Store which admin created it

  if (!payload.status) {
    payload.status = "inactive";
  }

  if (!payload.position) {
    payload.position = "center";
  }

  if (!payload.size) {
    payload.size = "medium";
  }

  if (!payload.display_order) {
    payload.display_order = 0;
  }

  if (payload.is_closable === undefined) {
    payload.is_closable = true;
  }

  // Validate date range
  if (payload.start_date && payload.end_date) {
    const startDate = new Date(payload.start_date);
    const endDate = new Date(payload.end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return responseBadRequest(res, t("invalid_date_format"));
    }
    if (startDate > endDate) {
      return responseBadRequest(res, t("start_date_before_end_date"));
    }
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
};

