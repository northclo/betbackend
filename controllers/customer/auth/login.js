import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import UserModel from "../../../models/User.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import { config } from "../../../config/index.js";

export const login = async (req, res) => {
  const { email, password } = req.body;

  let user = await UserModel.findOne({
    user_email: email,
  });

  if (!user) {
    return responseBadRequest(res, "Cannot find user");
  }

  let isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return responseBadRequest(res, "Password isn't correct!");
  }

  let token = jwt.sign({ id: user._id }, config.JWT_SECRET_KEY, { expiresIn: '1h' });
  responseSuccess(res, { token });
};
