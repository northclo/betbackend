import mongoose from "mongoose";
const { Schema } = mongoose;

const BettingResultSchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId },
        game_id: { type: String },
        total_no: { type: Number },
        today_no: { type: Number },
        betting_type: { type: String },
        betting_rate: { type: Number },
        win: { type: Boolean },
        number_sort: [{ type: Number }],
        bet_amount: { type: Number },
        earning_amount: { type: Number },
        history_view: { type: Boolean, default: true }
    },
    { timestamps: true }
);

const BettingResultModel = mongoose.model("betting_result", BettingResultSchema);

export default BettingResultModel;
