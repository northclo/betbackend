import { responseBadRequest, responseServerError, responseSuccess } from "../../../helper/response.js";
import SupportMessage from "../../../models/SupportMessage.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const submitContactMessage = async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return responseBadRequest(res, "Please provide your name, email, and message.");
  }

  if (!emailPattern.test(email)) {
    return responseBadRequest(res, "Please provide a valid email address.");
  }

  try {
    const supportMessage = await SupportMessage.create({
      name,
      email,
      message,
    });

    return responseSuccess(
      res,
      { id: supportMessage._id },
      "Your message has been received. Our support team will reach out soon."
    );
  } catch (error) {
    console.error("Error submitting support message:", error);
    return responseServerError(res);
  }
};
