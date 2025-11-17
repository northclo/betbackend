import { responseBadRequest, responseServerError, responseSuccess } from "../../../helper/response.js";
import SupportMessage from "../../../models/SupportMessage.js";
import { t } from "../../../helper/translation.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const submitContactMessage = async (req, res) => {
  const { name, email, subject, message, userId } = req.body;

  if (!name || !email || !subject || !message) {
    return responseBadRequest(res, t("provide_name_email_subject_message"));
  }

  if (!emailPattern.test(email)) {
    return responseBadRequest(res, t("provide_valid_email"));
  }

  try {
    const supportMessage = await SupportMessage.create({
      name,
      email,
      subject,
      message,
      userId: userId || null,
      status: "open",
      priority: "medium",
    });

    return responseSuccess(
      res,
      { id: supportMessage._id },
      t("message_received")
    );
  } catch (error) {
    console.error("Error submitting support message:", error);
    return responseServerError(res);
  }
};
