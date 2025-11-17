import bcrypt from "bcrypt";

import {
  responseBadRequest,
  responseSuccess,
} from "../../../helper/response.js";
import AdminModel from "../../../models/Admin.js";
import { t } from "../../../helper/translation.js";

const ADMIN_ID_REGEX = /^[A-Za-z0-9_-]{3,50}$/;
const VIEW_MANAGER_ID_REGEX = /^[A-Za-z][A-Za-z0-9_-]{3,31}$/;

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const validateAdminPayload = (admin, currentAdminId) => {
  if (!admin || typeof admin !== "object") {
    return { error: t("invalid_administrator_payload") };
  }

  const id = normalizeString(admin.id);
  const password = normalizeString(admin.password);

  if (!id) {
    return { error: t("administrator_id_required") };
  }

  if (!ADMIN_ID_REGEX.test(id)) {
    return { error: t("administrator_id_format_invalid") };
  }

  if (currentAdminId && id !== currentAdminId) {
    return { error: t("administrator_id_cannot_changed") };
  }

  if (!password) {
    return {
      error: t("administrator_password_required"),
    };
  }

  if (password.length < 8) {
    return {
      error: t("administrator_password_min_length"),
    };
  }

  return { password };
};

const validateViewManagerPayload = (viewManager) => {
  if (!viewManager || typeof viewManager !== "object") {
    return { error: t("invalid_view_manager_payload") };
  }

  const id = normalizeString(viewManager.id);
  const password = normalizeString(viewManager.password);

  if (!id) {
    return { error: t("view_manager_id_required") };
  }

  if (!VIEW_MANAGER_ID_REGEX.test(id)) {
    return {
      error: t("view_manager_id_format"),
    };
  }

  if (password && password.length < 8) {
    return {
      error: t("view_manager_password_min_length"),
    };
  }

  const result = { id };
  if (password) {
    result.password = password;
  }
  return result;
};

export const getAdminAccount = async (req, res) => {
  const admin = await AdminModel.findById(req.session?._id).lean();

  if (!admin) {
    return responseBadRequest(res, t("administrator_not_found"));
  }

  return responseSuccess(res, {
    admin: {
      id: admin.admin_id ?? "",
      passwordChangedAt: admin.password_change_time ?? null,
    },
    viewManager: {
      id: admin.view_manager_id ?? "",
      passwordChangedAt: admin.view_manager_password_change_time ?? null,
    },
  });
};

export const updateAdminAccount = async (req, res) => {
  const { admin, viewManager } = req.body || {};

  if (!admin && !viewManager) {
    return responseBadRequest(
      res,
      t("administrator_or_view_manager_required")
    );
  }

  const adminDoc = await AdminModel.findById(req.session?._id);

  if (!adminDoc) {
    return responseBadRequest(res, t("administrator_not_found"));
  }

  if (admin) {
    const adminValidation = validateAdminPayload(admin, adminDoc.admin_id);
    if (adminValidation.error) {
      return responseBadRequest(res, adminValidation.error);
    }

    if (adminValidation.password) {
      const hashedPassword = await bcrypt.hash(adminValidation.password, 10);
      adminDoc.password = hashedPassword;
      adminDoc.password_change_time = new Date();
    }
  }

  if (viewManager) {
    const viewManagerValidation = validateViewManagerPayload(viewManager);
    if (viewManagerValidation.error) {
      return responseBadRequest(res, viewManagerValidation.error);
    }

    const currentViewManagerId = adminDoc.view_manager_id || "";
    const newViewManagerId = viewManagerValidation.id || "";
    const isIdChanged = currentViewManagerId !== newViewManagerId;
    
    if (isIdChanged) {
      const existingViewManager = await AdminModel.findOne({
        view_manager_id: viewManagerValidation.id,
        _id: { $ne: adminDoc._id },
      }).lean();

      if (existingViewManager) {
        return responseBadRequest(res, t("view_manager_id_in_use"));
      }
    }

    adminDoc.view_manager_id = viewManagerValidation.id;

    if (viewManagerValidation.password) {
      const hashedPassword = await bcrypt.hash(
        viewManagerValidation.password,
        10
      );
      adminDoc.view_manager_password = hashedPassword;
      adminDoc.view_manager_password_change_time = new Date();
    }
  }

  await adminDoc.save();

  return responseSuccess(res);
};

