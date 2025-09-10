import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import isEmpty from "is-empty";

import { config } from "../../../config/index.js";
import {
  responseBadRequest,
  responseSuccess,
} from "../../../helper/response.js";
import UserModel from "../../../models/User.js";

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET_KEY);

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    let admin = await UserModel.findById(decoded.id);

    if (isEmpty(admin)) {
      return responseBadRequest(res, "Invalid token");
    }

    // Update admin
    await UserModel.findByIdAndUpdate(decoded.id, {
      password: hashedPassword,
    });

    return responseSuccess(res, {}, "Password reset successful");
  } catch (err) {
    return responseBadRequest(res, {}, "Invalid or expired token");
  }
};
