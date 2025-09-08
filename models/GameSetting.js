import mongoose from "mongoose";
const { Schema } = mongoose;

const GameSettingSchema = new Schema(
    {
        name: { type: String },
        activate: { type: Boolean, default: true },
        inactive_message: { type: String },
        duplicate_betting: { type: Boolean, default: true },
        duplicate_betting_limit: { type: Number, default: 0 },
        option: [
            {
                name: { type: String },
                odd: { type: Number },
                even: { type: Number },
                under: { type: Number },
                over: { type: Number },
                odd_under: { type: Number },
                odd_over: { type: Number },
                even_under: { type: Number },
                even_over: { type: Number },
                match_number1: { type: Number },
                match_number2: { type: Number },
                match_number3: { type: Number },
            }
        ]
    },
    { timestamps: true }
);

const GameSettingModel = mongoose.model("game_setting", GameSettingSchema);

export default GameSettingModel;
