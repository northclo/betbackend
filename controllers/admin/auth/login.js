import isEmpty from "is-empty";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import AdminModel from "../../../models/admin.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import { config } from "../../../config/index.js";

export const login = async (req, res) => {
  // get user from db
  let user = await AdminModel.findOne({
    email: req.body.email,
  });

  // if cannot find user
  if (isEmpty(user)) {
    return responseBadRequest(res, "cannot find user");
  }

  // check if password is correct
  let isMatch = await bcrypt.compare(req.body.password, user.password);

  if (isMatch) {
    let token = jwt.sign({ token: user._id }, config.JWT_SECRET_KEY, { expiresIn: '1h' });
    responseSuccess(res, "", { token: token });
  } else {
    responseBadRequest(res, "password isn't correct!");
  }
};
