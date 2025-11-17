import { StatusCodes } from "http-status-codes";
import { t } from "./translation.js";

export const responseSuccess = (res, data, message = "") => {
  return res.status(StatusCodes.OK).send({
    message: message,
    data: data,
  });
};

export const responseNotFound = (res) => {
  return res.status(StatusCodes.NOT_FOUND).send({
    message: t("api_not_found"),
    data: "",
  });
};

export const responseBadRequest = (res, message = null) => {
  return res.status(StatusCodes.BAD_REQUEST).send({
    message: message || t("invalid_request"),
    data: {},
  });
};

export const responseUnAutherized = (res) => {
  return res.status(StatusCodes.UNAUTHORIZED).send({
    message: t("unauthorized_user"),
    data: "",
  });
};

export const responseServerError = (res) => {
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
    message: t("server_error"),
    data: "",
  });
};
