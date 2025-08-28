import jwt from "jsonwebtoken";

import { config } from "../config/index.js";
import { responseServerError, responseUnAutherized } from "../helper/response.js";

export const checkAuth = (req, res, next) => {
  try {
    if (!req.headers["autherization"]) {
      return responseUnAutherized(res);
    }

    jwt.verify(req.headers["autherization"], config.JWT_SECRET_KEY, (err, decoded) => {
      if (err) {
        return responseUnAutherized(res);
      }

      req.session = { _id: decoded.token };
      next();
    });
  } catch (error) {
    return responseServerError(res);
  }
};
