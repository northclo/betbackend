import mongoose from "mongoose";
const { Schema } = mongoose;

const GameSettingSchema = new Schema(
    {
        name: { type: String },
        activate: { type: Boolean, default: true },
        inactiveMessage: { type: String },
        duplicateBetting: { type: Boolean, default: true },
        duplicateBettingLimit: { type: Number, default: 0 },
        odd: [{ type: Number }],
        even: [{ type: Number }],
        under: [{ type: Number }],
        over: [{ type: Number }],
        oddUnder: [{ type: Number }],
        oddOver: [{ type: Number }],
        evenUnder: [{ type: Number }],
        evenOver: [{ type: Number }],
        matchNumber1: [{ type: Number }],
        matchNumber2: [{ type: Number }],
        matchNumber3: [{ type: Number }],
    },
    { timestamps: true }
);

const GameSettingModel = mongoose.model("game_setting", GameSettingSchema);

export default GameSettingModel;
