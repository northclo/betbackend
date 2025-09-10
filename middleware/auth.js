import jwt from "jsonwebtoken";

import { config } from "../config/index.js";
import { responseServerError, responseUnAutherized } from "../helper/response.js";

export const checkAuth = (req, res, next) => {
  try {
    if (!req.headers["authorization"]) {
      return responseUnAutherized(res);
    }

    jwt.verify(req.headers["authorization"], config.JWT_SECRET_KEY, (err, decoded) => {
      if (err) {
        return responseUnAutherized(res);
      }

      req.session = { _id: decoded.id };
      next();
    });
  } catch (error) {
    return responseServerError(res);
  }
};
