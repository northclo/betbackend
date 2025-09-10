import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import { config } from "../../../config/index.js";

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return responseBadRequest(res, "Email and password are required.");
  }

  const user = await UserModel.findOne({ user_email: email }).lean();
  if (!user) {
    return responseBadRequest(res, "Invalid credentials.");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return responseBadRequest(res, "Invalid credentials.");
  }

  const partner = await PartnerModel.findOne({ user_id: user._id }).lean();
  if (partner && !partner.dashboard_access_permission) {
    return responseBadRequest(res, "Access denied.");
  }

  const token = jwt.sign({ id: user._id }, config.JWT_SECRET_KEY, { expiresIn: "1h" });

  return responseSuccess(res, { token }, "Login successful.");
};
