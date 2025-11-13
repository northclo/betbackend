import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { io, onlineUsers } from "../../../server.js";

export const logoutUser = async (req, res) => {
    const { user_nickname } = req.body;

    if (!user_nickname) {
        return responseBadRequest(res, "User nickname is required.");
    }

    const user = await UserModel.findOne({ user_nickname: user_nickname });

    if (!user) {
        return responseBadRequest(res, "User not found.");
    }

    const userId = String(user._id);
    const socketId = onlineUsers.get(userId);
    if (socketId) {
        io.to(socketId).emit("user_logout", { message: "You have been logged out" });
        onlineUsers.delete(userId);
    }

    await UserModel.updateOne({ _id: user._id }, { login_status: false });

    responseSuccess(res, null, "User logged out successfully.");
}