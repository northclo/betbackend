import jwt from "jsonwebtoken";

import { config } from "../config/index.js";
import { responseServerError, responseUnAutherized } from "../helper/response";

export const checkAuth = (req, res, next) => {
  try {
    if (!req.headers["autherization"]) {
      return responseUnAutherized(res);
    }

    let decoded = jwt.verify(
      req.headers["autherization"],
      config.JWT_SECRET_KEY
    );

    next();
  } catch (error) {
    return responseServerError(res);
  }
};
