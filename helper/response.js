import { StatusCodes } from "http-status-codes";

export const responseSuccess = (res, message = "", data) => {
  return res.status(StatusCodes.OK).send({
    message: message,
    data: data,
  });
};

export const responseNotFound = (res) => {
  return res.status(StatusCodes.NOT_FOUND).send({
    message: "Requested API not found (404)",
    data: "",
  });
};

export const responseBadRequest = (res, message = "Invalid request!", data) => {
  return res.status(StatusCodes.BAD_REQUEST).send({
    message: message,
    data: data,
  });
};

export const responseUnAutherized = (res) => {
  return res.status(StatusCodes.UNAUTHORIZED).send({
    message: "Unautherized user",
    data: "",
  });
};

export const responseServerError = (res) => {
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
    message: "Server error (500). Please try again later.",
    data: "",
  });
};
