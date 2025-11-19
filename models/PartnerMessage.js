import mongoose from "mongoose";
import { messageType } from "../const/type.js";
const { Schema, model } = mongoose;

const PartnerMessageSchema = new Schema(
    {
        sender: { type: mongoose.Types.ObjectId },
        receiver: { type: mongoose.Types.ObjectId },
        title: { type: String },
        content: { type: String },
        expire_at: { type: Number },
        type: {
            type: String,
            enum: [messageType.groupMessasge, messageType.notice],
            default: messageType.notice
        }
    },
    { timestamps: true }
);

const PartnerMessageModel = model("partner_message", PartnerMessageSchema);

export default PartnerMessageModel;
