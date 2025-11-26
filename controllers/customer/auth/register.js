import bcrypt from "bcrypt";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import SettingModel from "../../../models/Setting.js";
import { responseBadRequest, responseSuccess, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { userStatus } from "../../../const/status.js";
import { membershipType } from "../../../const/type.js";

export const register = async (req, res) => {
  try {
    const { user_name, password, nickname, recommender_code, captcha, bank_id, bank_number, bank_owner_name } = req.body;

    if (!user_name || !password || !nickname) {
      return responseBadRequest(res, t("user_name_password_nickname_required"));
    }

    if (!bank_id || !bank_number || !bank_owner_name) {
      return responseBadRequest(res, t("bank_information_required"));
    }

    const userNameRegex = /^[a-zA-Z0-9]{4,12}$/;
    if (!userNameRegex.test(user_name)) {
      return responseBadRequest(res, t("invalid_user_name_format"));
    }

    if (password.length < 6) {
      return responseBadRequest(res, t("password_min_length_6"));
    }

    const existingUserByUserName = await UserModel.findOne({
      user_name: user_name.trim(),
    });
    if (existingUserByUserName) {
      return responseBadRequest(res, t("user_name_already_exists"));
    }

    const existingPartnerByPartnerId = await PartnerModel.findOne({
      partner_id: user_name.trim(),
    });
    if (existingPartnerByPartnerId) {
      return responseBadRequest(res, t("user_name_already_exists"));
    }

    const existingUserByNickname = await UserModel.findOne({
      user_nickname: nickname,
    });
    if (existingUserByNickname) {
      return responseBadRequest(res, t("nickname_already_exists"));
    }

    const siteSetting = await SettingModel.findOne().lean();
    const membershipRegistration =
      siteSetting?.membership_registration || membershipType.recommender;
    const membershipApproval = siteSetting?.membership_approval ?? true;
    const securityEnabled = siteSetting?.security ?? true;
    const depositBanks = Array.isArray(siteSetting?.deposit_banks) ? siteSetting.deposit_banks : [];

    if (membershipRegistration === membershipType.no_use) {
      return responseBadRequest(res, t("registration_disabled"));
    }

    if (!depositBanks.includes(bank_id)) {
      return responseBadRequest(res, t("invalid_bank_selected"));
    }

    if (securityEnabled) {
      if (!captcha) {
        return responseBadRequest(res, t("captcha_required"));
      }
      
      const sessionCaptcha = req.session?.captcha;
      if (!sessionCaptcha) {
        return responseBadRequest(res, t("captcha_session_expired"));
      }
      
      if (captcha.toLowerCase() !== sessionCaptcha.toLowerCase()) {
        return responseBadRequest(res, t("captcha_incorrect"));
      }
      
      delete req.session.captcha;
    }

    if (membershipRegistration === membershipType.recommender) {
      if (!recommender_code) {
        return responseBadRequest(res, t("recommender_code_required"));
      }

      const recommender = await UserModel.findOne({
        $or: [
          { user_nickname: recommender_code },
          { _id: recommender_code },
        ],
      });

      if (!recommender) {
        return responseBadRequest(res, t("recommender_not_found"));
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const hashedExchangePassword = await bcrypt.hash(password, salt);

    const status = membershipApproval ? userStatus.wait : userStatus.normal;

    const newUser = await UserModel.create({
      user_name: user_name.trim(),
      user_nickname: nickname,
      password: hashedPassword,
      exchange_secure_number: hashedExchangePassword,
      user_status: status,
      user_level: 1,
      own_money: 0,
      recommend_id: recommender_code || null,
      bank_id: bank_id.trim(),
      bank_number: bank_number.trim(),
      bank_owner_name: bank_owner_name.trim(),
    });

    return responseSuccess(res, {
      message: membershipApproval
        ? t("registration_success_pending_approval")
        : t("registration_success"),
      user_id: newUser._id,
      status: newUser.user_status,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return responseServerError(res);
  }
};

