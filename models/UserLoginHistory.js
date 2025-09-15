import mongoose from "mongoose";
const { Schema, model } = mongoose;

const UserLoginHistorySchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId },
        login_date: { type: Number },
        ip_address: { type: String },
        location: { type: String },
        device: { type: String },
        mobile: { type: Boolean, default: false },
        login_status: { type: Boolean, default: false }
    },
    { timestamps: true }
);

const UserLoginHistoryModel = model("user_login_history", UserLoginHistorySchema);

export default UserLoginHistoryModel;
