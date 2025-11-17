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

export const updateQuestion = async (req, res) => {
  try {
    const userId = req.session._id;

    if (!userId) {
      return responseUnAutherized(res);
    }

    const { questionId } = req.params;
    const { title, question } = req.body;

    if (!questionId) {
      return responseBadRequest(res, t("question_id_required"));
    }

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return responseBadRequest(res, t("invalid_question_id_format"));
    }

    if (!title || String(title).trim().length === 0) {
      return responseBadRequest(res, t("title_required"));
    }

    if (!question || String(question).trim().length === 0) {
      return responseBadRequest(res, t("question_required"));
    }

    const existingQuestion = await SupportMessage.findOne({
      _id: questionId,
      userId: userId,
    });

    if (!existingQuestion) {
      return responseNotFound(res);
    }

    if (existingQuestion.status !== "pending") {
      return responseBadRequest(
        res,
        t("cannot_edit_resolved_question")
      );
    }

    existingQuestion.title = String(title).trim();
    existingQuestion.question = String(question).trim();
    existingQuestion.sendDate = new Date();

    await existingQuestion.save();

    return responseSuccess(
      res,
      {
        id: existingQuestion._id.toString(),
        title: existingQuestion.title,
        question: existingQuestion.question,
        status: existingQuestion.status,
      },
      t("question_updated_successfully")
    );
  } catch (error) {
    console.error("Error updating question:", error);
    return responseServerError(res);
  }
};

