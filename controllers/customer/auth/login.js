import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import UserModel from "../../../models/User.js";
import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import BlockIpModel from "../../../models/BlockIp.js";
import { responseBadRequest, responseSuccess, responseServerError } from "../../../helper/response.js";
import { config } from "../../../config/index.js";
import { t } from "../../../helper/translation.js";
import { getLoginInfo } from "../../../helper/LoginInfo/get-login-info.js";
import { userStatus } from "../../../const/status.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const loginInfo = getLoginInfo(req);
    const ipAddress = loginInfo.ip_address;
    
    if (ipAddress && ipAddress !== "Unknown") {
      const blockedIp = await BlockIpModel.findOne({ ip_address: ipAddress });
      if (blockedIp) {
        return responseBadRequest(res, t("ip_address_blocked"));
      }
    }

    let user = await UserModel.findOne({
      user_email: email,
    });

    if (!user) {
      return responseBadRequest(res, t("cannot_find_user"));
    }

    if (
      user.user_status === userStatus.wait ||
      user.user_status === userStatus.stop ||
      user.user_status === userStatus.cancel ||
      user.user_status === userStatus.danger
    ) {
      return responseBadRequest(res, t("user_account_restricted"));
    }

    let isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return responseBadRequest(res, t("password_incorrect"));
    }

    await UserLoginHistoryModel.create({
      user_id: user._id,
      ip_address: loginInfo.ip_address,
      login_date: Date.now(),
      device: loginInfo.device,
      location: loginInfo.location,
      mobile: loginInfo.mobile
    });

    let token = jwt.sign({ id: user._id }, config.JWT_SECRET_KEY, { expiresIn: '1h' });
    responseSuccess(res, { token });
  } catch (error) {
    console.error("Error during customer login:", error);
    return responseServerError(res);
  }
};
