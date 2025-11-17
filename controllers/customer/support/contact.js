import requestIp from "request-ip";
import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const submitContact = async (req, res) => {
  try {
    const userId = req.session._id;

    if (!userId) {
      return responseUnAutherized(res);
    }

    const { title, question } = req.body;

    if (!title || String(title).trim().length === 0) {
      return responseBadRequest(res, t("title_required"));
    }

    if (!question || String(question).trim().length === 0) {
      return responseBadRequest(res, t("question_required"));
    }

    const user = await UserModel.findById(userId).lean();
    if (!user) {
      return responseUnAutherized(res);
    }

    const ipAddress = requestIp.getClientIp(req) || req.ip || req.connection?.remoteAddress || t("unknown");
  
    const cleanIp = ipAddress.replace(/^::ffff:/, "");

    const firstMessage = await SupportMessage.findOne({ userId: userId })
      .sort({ firstMessageDate: 1, createdAt: 1 })
      .lean();

    const firstMessageDate = firstMessage?.firstMessageDate || new Date();

    const supportMessage = await SupportMessage.create({
      userId: userId,
      user_nickname: user.user_nickname || "",
      title: String(title).trim(),
      question: String(question).trim(),
      status: "pending",
      firstMessageDate: firstMessageDate,
      sendDate: new Date(),
      ipAddress: cleanIp,
    });

    try {
      const io = req.app.get("io");
      if (io) {
        io.emit("new_support_message", {
          id: supportMessage._id.toString(),
          title: supportMessage.title,
          user_nickname: supportMessage.user_nickname,
          userId: userId.toString(),
          status: supportMessage.status,
          createdAt: supportMessage.createdAt,
          sendDate: supportMessage.sendDate,
        });
      }
    } catch (socketError) {
      console.error("Error emitting socket event:", socketError);
    }

    return responseSuccess(
      res,
      {
        id: supportMessage._id.toString(),
        title: supportMessage.title,
        question: supportMessage.question,
        status: supportMessage.status,
      },
      t("question_submitted_successfully")
    );
  } catch (error) {
    console.error("Error submitting contact:", error);
    return responseServerError(res);
  }
};

