import mongoose from "mongoose";
const { Schema } = mongoose;

const BettingResultSchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId },
        game_id: { type: String },
        bet_list: [{ type: Number }],
        win: { type: Number }, // 1: win, 0: lose,
        bet_amount: { type: Number },
        earning_amount: { type: Number },
    },
    { timestamps: true }
);

const BettingResultModel = mongoose.model("betting_result", BettingResultSchema);

export default BettingResultModel;
