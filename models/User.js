import mongoose from "mongoose";
const { Schema, model } = mongoose;
import { userStatus } from "../const/status.js";

const UserSchema = new Schema(
    {
        user_nickname: { type: String, required: true, unique: true, index: true },
        password: { type: String, required: true },
        exchange_secure_number: { type: String, required: true },
        user_name: { type: String, required: true, unique: true, index: true },
        partner_id: { type: mongoose.Types.ObjectId },
        ownpartner_id: { type: mongoose.Types.ObjectId },
        phone_number: {
            active_code: { type: String },
            phone_number_1: { type: String },
            phone_number_2: { type: String }
        },
        bank_id: { type: mongoose.Types.ObjectId, required: true },
        bank_number: { type: String, required: true },
        bank_owner_name: { type: String, required: true },
        memo_note: { type: String },
        simple_bet_rate: { type: Number, default: 0 },
        combined_bet_rate: { type: Number, default: 0 },
        match_num_bet_rate: { type: Number, default: 0 },
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
        consider_user: { type: Boolean, default: false },
        login_status: { type: Boolean, default: false },
        password_change_time: { type: Number }
    },
    { timestamps: true }
);

const UserModel = model("user", UserSchema);

export default UserModel;
