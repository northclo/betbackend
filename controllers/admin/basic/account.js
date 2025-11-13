import bcrypt from "bcrypt";

import {
  responseBadRequest,
  responseSuccess,
} from "../../../helper/response.js";
import UserModel from "../../../models/User.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIEW_MANAGER_ID_REGEX = /^[A-Za-z][A-Za-z0-9_-]{3,31}$/;

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const validateAdminPayload = (admin, currentEmail) => {
  if (!admin || typeof admin !== "object") {
    return { error: "Invalid administrator payload." };
  }

  const id = normalizeString(admin.id);
  const password = normalizeString(admin.password);

  if (!id) {
    return { error: "Administrator ID is required." };
  }

  if (!EMAIL_REGEX.test(id)) {
    return { error: "Administrator ID must be a valid email." };
  }

  if (currentEmail && id.toLowerCase() !== currentEmail.toLowerCase()) {
    return { error: "Administrator ID cannot be changed." };
  }

  if (!password) {
    return {
      error: "Administrator password is required.",
    };
  }

  if (password.length < 8) {
    return {
      error: "Administrator password must be at least 8 characters long.",
    };
  }

  return { password };
};

const validateViewManagerPayload = (viewManager) => {
  if (!viewManager || typeof viewManager !== "object") {
    return { error: "Invalid view manager payload." };
  }

  const id = normalizeString(viewManager.id);
  const password = normalizeString(viewManager.password);

  if (!id) {
    return { error: "View manager ID is required." };
  }

  if (!VIEW_MANAGER_ID_REGEX.test(id)) {
    return {
      error:
        "View manager ID must start with a letter and can include letters, numbers, hyphen, or underscore (4-32 characters).",
    };
  }

  if (password && password.length < 8) {
    return {
      error: "View manager password must be at least 8 characters long.",
    };
  }

  const result = { id };
  if (password) {
    result.password = password;
  }
  return result;
};

export const getAdminAccount = async (req, res) => {
  const adminUser = await UserModel.findById(req.session?._id).lean();

  if (!adminUser) {
    return responseBadRequest(res, "Administrator not found.");
  }

  return responseSuccess(res, {
    admin: {
      id: adminUser.user_email ?? "",
      passwordChangedAt: adminUser.password_change_time ?? null,
    },
    viewManager: {
      id: adminUser.view_manager_id ?? "",
      passwordChangedAt: adminUser.view_manager_password_change_time ?? null,
    },
  });
};

export const updateAdminAccount = async (req, res) => {
  const { admin, viewManager } = req.body || {};

  if (!admin && !viewManager) {
    return responseBadRequest(
      res,
      "Administrator or view manager information is required."
    );
  }

  const adminUser = await UserModel.findById(req.session?._id);

  if (!adminUser) {
    return responseBadRequest(res, "Administrator not found.");
  }

  if (admin) {
    const adminValidation = validateAdminPayload(admin, adminUser.user_email);
    if (adminValidation.error) {
      return responseBadRequest(res, adminValidation.error);
    }

    if (adminValidation.password) {
      const hashedPassword = await bcrypt.hash(adminValidation.password, 10);
      adminUser.password = hashedPassword;
      adminUser.password_change_time = Date.now();
    }
  }

  if (viewManager) {
    const viewManagerValidation = validateViewManagerPayload(viewManager);
    if (viewManagerValidation.error) {
      return responseBadRequest(res, viewManagerValidation.error);
    }

    const currentViewManagerId = adminUser.view_manager_id || "";
    const newViewManagerId = viewManagerValidation.id || "";
    const isIdChanged = currentViewManagerId !== newViewManagerId;
    
    if (isIdChanged) {
      const existingViewManager = await UserModel.findOne({
        view_manager_id: viewManagerValidation.id,
        _id: { $ne: adminUser._id },
      }).lean();

      if (existingViewManager) {
        return responseBadRequest(res, "View manager ID already in use.");
      }
    }

    adminUser.view_manager_id = viewManagerValidation.id;

    if (viewManagerValidation.password) {
      const hashedPassword = await bcrypt.hash(
        viewManagerValidation.password,
        10
      );
      adminUser.view_manager_password = hashedPassword;
      adminUser.view_manager_password_change_time = Date.now();
    }
  }

  await adminUser.save();

  return responseSuccess(res);
};

