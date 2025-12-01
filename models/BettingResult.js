import mongoose from "mongoose";
const { Schema } = mongoose;

const BettingResultSchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId },
        game_id: { type: String },
        total_no: { type: Number },
        today_no: { type: Number },
        betting_type: {
            type: String,
            enum: ["odd", "even", "under", "over", "odd_under", "odd_over", "even_under", "even_over", "number_13", "number_14", "number_16"],
            required: true,
        },
        betting_rate: { type: Number },
        win: { type: Boolean, default: false },
        number_sort: [{ type: Number }],
        bet_amount: { type: Number },
        earning_amount: { type: Number, default: 0 },
        final_amount: {type: Number, default: 0},
        betting_point_rate: { type: Number },
        betting_point_value: { type: Number },
        partner_bet_benefit: { type: Number },
        betting_status: {
            type: String,
            enum: ["WAIT", "PROGRESS", "COMPLETE", "CANCEL"],
            default: "WAIT",
        },
        history_view: { type: Boolean, default: true }
    },
    { timestamps: true }
);

BettingResultSchema.index({ game_id: 1, betting_status: 1, betting_type: 1 });
BettingResultSchema.index({ game_id: 1 });
BettingResultSchema.index({ user_id: 1, game_id: 1 });
BettingResultSchema.index({ betting_status: 1 });

const BettingResultModel = mongoose.model("betting_result", BettingResultSchema);

export default BettingResultModel;
