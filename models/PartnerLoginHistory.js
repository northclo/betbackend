import mongoose from "mongoose";
const { Schema, model } = mongoose;

const PartnerLoginHistorySchema = new Schema(
    {
        partner_id: { type: mongoose.Types.ObjectId },
        login_date: { type: Number },
        ip_address: { type: String },
        location: { type: String },
        device: { type: String },
        mobile: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const PartnerLoginHistoryModel = model("partner_login_history", PartnerLoginHistorySchema);

export default PartnerLoginHistoryModel;

