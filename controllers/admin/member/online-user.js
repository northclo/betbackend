import jwt from "jsonwebtoken";

import UserModel from "../../../models/User.js";
import { config } from "../../../config/index.js";

export const onlineUser = async (token, status) => {
    const decoded = jwt.verify(token, config.JWT_SECRET_KEY);
    const userId = decoded.id;

    await UserModel.updateOne({ _id: userId }, { login_status: status });

    return userId;
};
