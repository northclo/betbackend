import mongoose from "mongoose";
const { Schema, model } = mongoose;

const PartnerMessageSchema = new Schema(
    {
        sender: { type: mongoose.Types.ObjectId },
        receivers: [{ type: mongoose.Types.ObjectId }],
        title: { type: String },
        content: { type: String },
        expire_at: { type: Number }
    },
    { timestamps: true }
);

const PartnerMessageModel = model("partner_message", PartnerMessageSchema);

export default PartnerMessageModel;
