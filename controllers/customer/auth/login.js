import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import UserModel from "../../../models/User.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import { config } from "../../../config/index.js";
import { t } from "../../../helper/translation.js";

export const login = async (req, res) => {
  const { email, password } = req.body;

  let user = await UserModel.findOne({
    user_email: email,
  });

  if (!user) {
    return responseBadRequest(res, t("cannot_find_user"));
  }

  let isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return responseBadRequest(res, t("password_incorrect"));
  }

  let token = jwt.sign({ id: user._id }, config.JWT_SECRET_KEY, { expiresIn: '1h' });
  responseSuccess(res, { token });
};
