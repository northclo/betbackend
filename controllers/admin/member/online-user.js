import jwt from "jsonwebtoken";

import { config } from "../../../config/index.js";
import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";

export const onlineUser = async (token, status) => {
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET_KEY);
        const userId = decoded.id;

        // Update only currently active login records, e.g., last login or session not logged out
        await UserLoginHistoryModel.updateMany(
            { user_id: userId, login_status: { $ne: status } }, // optional filter
            { login_status: status }
        );

        return userId;

    } catch (err) {
        console.error("Invalid token or failed update:", err.message);
    }
};
