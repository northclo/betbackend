import mongoose from "mongoose";
const { Schema, model } = mongoose;

const GameResultSchema = new Schema({
    list: [{ type: Number }],
    today_no: { type: Number },
    total_no: { type: Number },
    current_no: { type: Number },
    manual_valid: { type: Boolean },
    start_time_stamp: { type: Number },
    end_time_stamp: { type: Number },
    cancel_time_stamp: { type: Number },
    game_id: { type: String },
    device_id: { type: String },
    odd: { type: Boolean, default: true },
    under: { type: Boolean, default: true },
},
    { timestamps: true }
);

GameResultSchema.index({ createdAt: -1 });
GameResultSchema.index({ today_no: 1 });
GameResultSchema.index({ start_time_stamp: -1 });
GameResultSchema.index({ end_time_stamp: -1 });
GameResultSchema.index({ cancel_time_stamp: -1 });
GameResultSchema.index({ start_time_stamp: -1, end_time_stamp: -1 });
GameResultSchema.index({ end_time_stamp: -1, cancel_time_stamp: -1 });
GameResultSchema.index({ game_id: 1 });

const GameResultModel = model('game_results', GameResultSchema);

export default GameResultModel;