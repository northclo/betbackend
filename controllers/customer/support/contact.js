import { responseBadRequest, responseServerError, responseSuccess } from "../../../helper/response.js";
import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import { t } from "../../../helper/translation.js";

export const submitContactMessage = async (req, res) => {
  const { title, question, userId } = req.body;

  if (!title || !question) {
    return responseBadRequest(res, t("provide_title_and_question") || "Title and question are required");
  }

  if (!userId) {
    return responseBadRequest(res, t("user_id_required") || "User ID is required");
  }

  try {
    const user = await UserModel.findById(userId).lean();
    if (!user) {
      return responseBadRequest(res, t("user_not_found") || "User not found");
    }

    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';
    const now = new Date();
    
    const supportMessage = await SupportMessage.create({
      userId,
      user_nickname: user.user_nickname || user.user_name || user.user_email || "Unknown",
      title,
      question,
      answer: "",
      firstMessageDate: now,
      sendDate: now,
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      status: "pending",
    });

    return responseSuccess(
      res,
      { id: supportMessage._id },
      t("message_received") || "Message received successfully"
    );
  } catch (error) {
    console.error("Error submitting support message:", error);
    return responseServerError(res);
  }
};
