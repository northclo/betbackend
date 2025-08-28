import { responseSuccess } from "../../../helper/response.js"
import UserModel from "../../../models/user.js";

export const deleteMemberList = async (req, res) => {
    let { id } = req.params;
    await UserModel.deleteOne({ _id: id })
    return responseSuccess(res)
}