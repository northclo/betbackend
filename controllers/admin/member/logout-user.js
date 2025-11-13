import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { io, onlineUsers } from "../../../server.js";

export const logoutUser = async (req, res) => {
    const { user_nickname } = req.body;

    const user = await UserModel.findOne({ user_nickname: user_nickname });

    if (!user) {
        return responseBadRequest(res);
    }

    const userId = String(user._id);
    const socketId = onlineUsers.get(userId);
    if (socketId) {
        io.to(socketId).emit("user_logout", { message: "You have been logged out" });
        onlineUsers.delete(userId);
    }

    responseSuccess(res);

}