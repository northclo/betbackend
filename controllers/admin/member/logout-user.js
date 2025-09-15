import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { io, onlineUsers } from "../../../server.js";

export const logoutUser = async (req, res) => {
    const { user_nickname } = req.body;

    const user = await UserModel.findOne({ user_nickname: user_nickname });

    if (!user) {
        return responseBadRequest(res);
    }

    const socketId = onlineUsers.get(String(user._id));
    if (socketId) {
        io.to(socketId).emit("user_logout", { message: "You have been logged out" });
        onlineUsers.delete(user_nickname); // optional cleanup
    }

    responseSuccess(res);

}