import mongoose from "mongoose";
const { Schema, model } = mongoose;

const BlockIpSchema = new Schema(
    {
        ip_address: { type: String },
    },
    { timestamps: true }
);

const BlockIpModel = model("block_ip", BlockIpSchema);

export default BlockIpModel;
