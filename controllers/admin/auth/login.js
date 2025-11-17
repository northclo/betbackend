import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import AdminModel from "../../../models/Admin.js";
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

  let admin = null;
  let foundPartner = null;
  
  // Try to find admin by partner_id first
  foundPartner = await PartnerModel.findOne({ partner_id: id }).lean();
  if (foundPartner && foundPartner.admin_id) {
    admin = await AdminModel.findById(foundPartner.admin_id).lean();
  }
  
  if (!admin) {
    admin = await AdminModel.findOne({ admin_id: id.trim() }).lean();
  }

  if (!admin) {
    return responseBadRequest(res, t("invalid_credentials"));
  }

  // Check if admin is active
  if (!admin.is_active) {
    return responseBadRequest(res, t("access_denied"));
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return responseBadRequest(res, t("invalid_credentials"));
  }

  // Check partner permissions if partner exists
  if (!foundPartner && admin.partner_id) {
    foundPartner = await PartnerModel.findById(admin.partner_id).lean();
  }
  
  if (foundPartner && !foundPartner.dashboard_access_permission) {
    return responseBadRequest(res, t("access_denied"));
  }

  const loginInfo = getLoginInfo(req);

  // Update admin last login
  await AdminModel.findByIdAndUpdate(admin._id, {
    last_login: Date.now()
  });

  // Log login history (using admin_id instead of user_id)
  await UserLoginHistoryModel.create({
    user_id: admin._id,
    ip_address: loginInfo.ip_address,
    login_date: Date.now(),
    device: loginInfo.device,
    location: loginInfo.location,
    mobile: loginInfo.mobile
  });

  const token = jwt.sign({ id: admin._id }, config.JWT_SECRET_KEY, { expiresIn: "1h" });

  return responseSuccess(res, { token }, t("login_successful"));
};
