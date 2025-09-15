import mongoose from "mongoose";
const { Schema, model } = mongoose;
import { userStatus } from "../const/status.js";

const UserSchema = new Schema(
    {
        user_nickname: { type: String, required: true },
        user_email: { type: String, required: true },
        password: { type: String },
        user_name: { type: String },
        user_first_name: { type: String },
        user_last_name: { type: String },
        partner_id: { type: mongoose.Types.ObjectId },
        own_partner_id: { type: mongoose.Types.ObjectId },
        phone_number: { type: String },
        bank_id: { type: String },
        bank_number: { type: String },
        bank_owner_name: { type: String },
        refund_bank_number: { type: String },
        memo_note: { type: String },
        simple_bet_rate: { type: Number },
        combined_bet_rate: { type: Number },
        match_num_bet_rate: { type: Number },
        own_money: { type: Number, default: 0 },
        point: { type: Number, default: 0 },
        recommend_id: { type: String },
        user_status: {
            type: String,
            enum: [userStatus.wait, userStatus.normal, userStatus.stop, userStatus.cancel, userStatus.danger, userStatus.tester],
            default: userStatus.wait
        },
        user_level: {
            type: Number,
            enum: [1, 2, 3, 4, 5, 6],
            default: 1
        },
        api_key: { type: String },
        consider_user: { type: Boolean },
        login_status: { type: Boolean, default: false }
    },
    { timestamps: true }
);

const UserModel = model("user", UserSchema);

export default UserModel;
