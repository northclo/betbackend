import UserModel from "../../../models/user.js";
import { responseSuccess } from "../../../helper/response.js";

export const getMemberList = async (req, res) => {
    let users = await UserModel.find().sort({ _id: -1 });
    return responseSuccess(res, "", users);
};
