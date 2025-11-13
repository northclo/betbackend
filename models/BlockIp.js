import mongoose from "mongoose";
const { Schema, model } = mongoose;

const BlockIpSchema = new Schema(
    {
        ip_address: { type: String },
        action_user_id: { type: mongoose.Types.ObjectId }
    },
    { timestamps: true }
);

const BlockIpModel = model("block_ip", BlockIpSchema);

export default BlockIpModel;
