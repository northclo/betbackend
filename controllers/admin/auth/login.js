import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import { config } from "../../../config/index.js";
import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import { getLoginInfo } from "../../../helper/LoginInfo/get-login-info.js";
import { t } from "../../../helper/translation.js";

export const login = async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return responseBadRequest(res, t("id_password_required"));
  }

  let user = null;
  let foundPartner = null;
  
  foundPartner = await PartnerModel.findOne({ partner_id: id }).lean();
  if (foundPartner && foundPartner.user_id) {
    user = await UserModel.findById(foundPartner.user_id).lean();
  }
  
  if (!user) {
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      user = await UserModel.findById(id).lean();
    }
  }
  
  if (!user) {
    user = await UserModel.findOne({ user_email: id }).lean();
  }

  if (!user) {
    return responseBadRequest(res, t("invalid_credentials"));
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return responseBadRequest(res, t("invalid_credentials"));
  }

  if (!foundPartner) {
    foundPartner = await PartnerModel.findOne({ user_id: user._id }).lean();
  }
  if (foundPartner && !foundPartner.dashboard_access_permission) {
    return responseBadRequest(res, t("access_denied"));
  }

  const loginInfo = getLoginInfo(req);

  await UserLoginHistoryModel.create({
    user_id: user._id,
    ip_address: loginInfo.ip_address,
    login_date: Date.now(),
    device: loginInfo.device,
    location: loginInfo.location,
    mobile: loginInfo.mobile
  })

  const token = jwt.sign({ id: user._id }, config.JWT_SECRET_KEY, { expiresIn: "1h" });

  return responseSuccess(res, { token }, t("login_successful"));
};
