import bcrypt from 'bcrypt';

import UserModel from "../../../models/user.js";
import { responseSuccess } from "../../../helper/response.js";

export const createMemberList = async (req, res) => {
    let { password } = req.body;

    // change password with hashed password
    const salt = await bcrypt.genSalt(10)
    req.body.password = await bcrypt.hash(password, salt)

    await UserModel.create(req.body);

    return responseSuccess(res)
}