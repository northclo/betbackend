import jwt from "jsonwebtoken";

import { config } from "../../../config/index.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";

export const onlineUser = async (token, status) => {
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET_KEY);
        const userId = decoded.id;
        
        const updateUser = await UserModel.updateOne({ _id: userId }, { login_status: status });
        
        if (updateUser.matchedCount === 0) {
            await PartnerModel.updateOne({ _id: userId }, { login_status: status });
        }

        return userId;
    } catch (error) {
        console.error("Error updating online user status:", error);
        throw error;
    }
};
