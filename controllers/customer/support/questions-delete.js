import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseBadRequest,
  responseSuccess,
  responseNotFound,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const deleteQuestion = async (req, res) => {
  try {
    const userId = req.session._id;

    if (!userId) {
      return responseUnAutherized(res);
    }

    const { questionId } = req.params;

    if (!questionId) {
      return responseBadRequest(res, t("question_id_required"));
    }

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return responseBadRequest(res, t("invalid_question_id_format"));
    }

    const question = await SupportMessage.findOne({
      _id: questionId,
      userId: userId,
    });

    if (!question) {
      return responseNotFound(res);
    }

    await SupportMessage.findByIdAndDelete(questionId);

    return responseSuccess(
      res,
      { id: questionId },
      t("question_deleted_successfully")
    );
  } catch (error) {
    console.error("Error deleting question:", error);
    return responseServerError(res);
  }
};

