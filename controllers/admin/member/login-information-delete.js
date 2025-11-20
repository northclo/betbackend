import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const deleteLoginInformation = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { id } = req.params;
    if (!id) {
      return responseBadRequest(res, t("login_information_id_required"));
    }

    const deleted = await UserLoginHistoryModel.findOneAndDelete({ _id: id });

    if (!deleted) {
      return responseBadRequest(res, t("login_information_not_found"));
    }

    return responseSuccess(res, null, t("login_information_deleted_successfully"));
  } catch (error) {
    console.error("Error to delete login information:", error);
    return responseServerError(res);
  }
};

