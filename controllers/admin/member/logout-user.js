import { responseBadRequest, responseSuccess, responseServerError } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { io, onlineUsers } from "../../../server.js";
import { t } from "../../../helper/translation.js";

export const logoutUser = async (req, res) => {
    try {
        const { user_nickname } = req.body;

        if (!user_nickname) {
            return responseBadRequest(res, t("user_nickname_required"));
        }

        const user = await UserModel.findOne({ user_nickname: user_nickname });

        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        const userId = String(user._id);
        const socketId = onlineUsers.get(userId);
        if (socketId) {
            io.to(socketId).emit("user_logout", { message: t("you_have_been_logged_out") });
            onlineUsers.delete(userId);
        }

        const updateResult = await UserModel.updateOne({ _id: user._id }, { login_status: false });

        if (updateResult.modifiedCount === 0 && updateResult.matchedCount === 0) {
            return responseBadRequest(res, t("failed_update_user_login_status"));
        }

        responseSuccess(res, null, t("user_logged_out_successfully"));
    } catch (error) {
        console.error("Error to logout user:", error);
        return responseServerError(res);
    }
}