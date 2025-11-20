import bcrypt from "bcrypt";

import {
  responseBadRequest,
  responseSuccess,
  responseServerError,
} from "../../../helper/response.js";
import PartnerModel from "../../../models/Partner.js";
import { t } from "../../../helper/translation.js";
import { partnerType } from "../../../const/type.js";

const validatePartnerPassword = (password) => {
  if (!password) {
    return { error: t("password_required") };
  }

  if (password.length < 6) {
    return {
      error: t("administrator_password_min_length"),
    };
  }

  return { password };
};

export const getAdminAccount = async (req, res) => {
  try {
    const partner = await PartnerModel.findById(req.session?._id).lean();

    if (!partner) {
      return responseBadRequest(res, t("partner_not_found"));
    }

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

    return responseSuccess(res, {
      admin: {
        id: partner.partner_id ?? "",
        passwordChangedAt: null,
      },
      permissions,
      role: partner.role,
    });
  } catch (error) {
    console.error("Error to get admin account:", error);
    return responseServerError(res);
  }
};

export const updateAdminAccount = async (req, res) => {
  try {
    const { admin } = req.body || {};
    const password = admin?.password;

    if (!password) {
      return responseBadRequest(
        res,
        t("password_required")
      );
    }

    const passwordValidation = validatePartnerPassword(password);
    if (passwordValidation.error) {
      return responseBadRequest(res, passwordValidation.error);
    }

    const partnerDoc = await PartnerModel.findById(req.session?._id);

    if (!partnerDoc) {
      return responseBadRequest(res, t("partner_not_found"));
    }

    const hashedPassword = await bcrypt.hash(passwordValidation.password, 10);
    partnerDoc.password = hashedPassword;
    await partnerDoc.save();

    return responseSuccess(res);
  } catch (error) {
    console.error("Error to update admin account:", error);
    return responseServerError(res);
  }
};

