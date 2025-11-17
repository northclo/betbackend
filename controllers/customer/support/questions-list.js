import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import {
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const getQuestionsList = async (req, res) => {
  try {
    const userId = req.session._id;

    if (!userId) {
      return responseUnAutherized(res);
    }

    const user = await UserModel.findById(userId).lean();
    if (!user) {
      return responseUnAutherized(res);
    }

    const { page = 1, limit = 10 } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const filter = { userId: userId };

    const [questions, total] = await Promise.all([
      SupportMessage.find(filter)
        .sort({ firstMessageDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      SupportMessage.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    const items = questions.map((item, index) => ({
      _id: item._id.toString(),
      id: item._id.toString(),
      index: (pageNumber - 1) * pageSize + index + 1,
      title: item.title || "",
      writer: item.user_nickname || "",
      date: item.createdAt || new Date(),
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
      status: item.status || "pending",
      question: item.question || "",
      answer: item.answer || "",
    }));

    return responseSuccess(res, {
      questions: items,
      page: pageNumber,
      totalPages: totalPages,
      total: total,
      limit: pageSize,
    });
  } catch (error) {
    console.error("Error fetching questions list:", error);
    return responseServerError(res);
  }
};

