import { StatusCodes } from "http-status-codes";

export const responseSuccess = (res, message = "", data) => {
  return res.status(StatusCodes.OK).send({
    data: data,
    message: message,
  });
};

export const responseNotFound = (res) => {
  return res.status(StatusCodes.NOT_FOUND).send("");
};

export const responseBadRequest = (res, message = "", data) => {
  return res.status(StatusCodes.BAD_REQUEST).send({
    message: message,
    data: data,
  });
};

export const responseUnAutherized = (res) => {
  return res.status(StatusCodes.UNAUTHORIZED).send("");
};

export const responseServerError = (res) => {
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("");
};
