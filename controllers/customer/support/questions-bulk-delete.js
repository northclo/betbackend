import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const bulkDeleteQuestions = async (req, res) => {
  try {
    const userId = req.session._id;

    if (!userId) {
      return responseUnAutherized(res);
    }

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return responseBadRequest(res, t("question_ids_required"));
    }

    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return responseBadRequest(res, t("no_valid_question_ids"));
    }

    const result = await SupportMessage.deleteMany({
      _id: { $in: validIds },
      writer: userId,
    });

    return responseSuccess(
      res,
      { deletedCount: result.deletedCount },
      t("successfully_deleted_questions", result.deletedCount)
    );
  } catch (error) {
    console.error("Error bulk deleting questions:", error);
    return responseServerError(res);
  }
};

