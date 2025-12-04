import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import PartnerModel from "../../../models/Partner.js";
import { responseBadRequest, responseSuccess, responseServerError } from "../../../helper/response.js";
import { config } from "../../../config/index.js";
import PartnerLoginHistoryModel from "../../../models/PartnerLoginHistory.js";
import { getLoginInfo } from "../../../helper/LoginInfo/get-login-info.js";
import { t } from "../../../helper/translation.js";
import { partnerType } from "../../../const/type.js";

export const login = async (req, res) => {
  try {
  const { id, password } = req.body;

  if (!id || !password) {
    return responseBadRequest(res, t("id_password_required"));
  }

  const partner = await PartnerModel.findOne({ partner_id: id.trim() }).lean();

  if (!partner) {
    return responseBadRequest(res, t("invalid_credentials"));
  }

  const isMatch = await bcrypt.compare(password, partner.password);
  if (!isMatch) {
    return responseBadRequest(res, t("invalid_credentials"));
  }

  const loginInfo = getLoginInfo(req);

  await PartnerLoginHistoryModel.create({
    partner_id: partner._id,
    ip_address: loginInfo.ip_address,
    login_date: Date.now(),
    device: loginInfo.device,
    location: loginInfo.location,
    mobile: loginInfo.mobile
  });

  const token = jwt.sign({ id: partner._id }, config.JWT_SECRET_KEY, { expiresIn: "1h" });

  const isHeadquater = partner.role === partnerType.headquater;
  const permissions = isHeadquater ? {
    partner_access_permission: true,
    sub_partner_creation_permission: true,
    user_creation_permission: true,
    sub_partner_settlement_rate: true,
    sub_partner_money_change: true,
  } : {
    partner_access_permission: partner.partner_access_permission || false,
    sub_partner_creation_permission: partner.sub_partner_creation_permission || false,
    user_creation_permission: partner.user_creation_permission || false,
    sub_partner_settlement_rate: partner.sub_partner_settlement_rate || false,
    sub_partner_money_change: partner.sub_partner_money_change || false,
  };

  return responseSuccess(res, { token, permissions, role: partner.role, id: partner._id }, t("login_successful"));
  } catch (error) {
    console.error("Error during login:", error);
    return responseServerError(res);
  }
};
