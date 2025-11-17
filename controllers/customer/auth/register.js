import bcrypt from "bcrypt";
import UserModel from "../../../models/User.js";
import SettingModel from "../../../models/Setting.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { userStatus } from "../../../const/status.js";
import { membershipType } from "../../../const/type.js";

export const register = async (req, res) => {
  try {
    const { email, password, nickname, recommender_code } = req.body;

    if (!email || !password || !nickname) {
      return responseBadRequest(res, t("email_password_nickname_required"));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return responseBadRequest(res, t("invalid_email_format"));
    }

    if (password.length < 6) {
      return responseBadRequest(res, t("password_min_length_6"));
    }

    const existingUserByEmail = await UserModel.findOne({
      user_email: email.toLowerCase(),
    });
    if (existingUserByEmail) {
      return responseBadRequest(res, t("email_already_exists"));
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

    if (membershipRegistration === membershipType.no_use) {
      return responseBadRequest(res, t("registration_disabled"));
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

    const status = membershipApproval ? userStatus.wait : userStatus.normal;

    const newUser = await UserModel.create({
      user_email: email.toLowerCase(),
      user_nickname: nickname,
      password: hashedPassword,
      user_name: nickname,
      user_status: status,
      user_level: 1,
      own_money: 0,
      recommend_id: recommender_code || null,
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
    return responseBadRequest(res, t("registration_failed"));
  }
};

