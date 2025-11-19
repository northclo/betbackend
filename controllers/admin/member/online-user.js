import jwt from "jsonwebtoken";

import UserModel from "../../../models/User.js";
import { config } from "../../../config/index.js";

export const onlineUser = async (token, status) => {
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET_KEY);
        const userId = decoded.id;

        await UserModel.updateOne({ _id: userId }, { login_status: status });

        return userId;
    } catch (error) {
        console.error("Error updating online user status:", error);
        throw error;
    }
};
