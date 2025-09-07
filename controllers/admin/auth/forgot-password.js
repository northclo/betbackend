import jwt from "jsonwebtoken";
import isEmpty from "is-empty";

import {
  responseBadRequest,
  responseServerError,
  responseSuccess,
} from "../../../helper/response.js";
import {
  smtpProviderForGmail,
  smtpProviderForHotmail,
} from "../../../helper/smtp-provider/index.js";
import { config } from "../../../config/index.js";
import UserModel from "../../../models/User.js";

export const forgotPassword = async (req, res) => {
  let { email } = req.body;

  if (!email) {
    return responseBadRequest(res, "Email is required!");
  }

  // get admin info from db
  let admin = await UserModel.findOne({ user_email: email });

  // if cannot get admin info
  if (isEmpty(admin)) {
    return responseBadRequest(res, "Cannot find admin");
  }

  const token = jwt.sign({ id: admin._id }, config.JWT_SECRET_KEY, {
    expiresIn: "15m",
  });

  let resetLink = `${config.CLIENT_URL}/auth/reset-password/${token}`;

  try {
    // get domain from email
    let domain = email.split("@")[1].toLowerCase();

    // send code via smtp
    if (domain.includes("gmail.com")) {
      // await smtpProviderForGmail(
      //   "Running Ball",
      //   email,
      //   "Password reset",
      //   `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
      // );
    } else if (domain.includes("hotmail.com")) {
      // await smtpProviderForHotmail(
      //   "Running Ball",
      //   email,
      //   "Password reset",
      //   `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
      // );
    } else {
      return responseBadRequest(
        res,
        "Mail has to be Gmail or Hotmail, Outlook mail"
      );
    }

    return responseSuccess(res);
  } catch (error) {
    responseServerError(res);
  }
};
