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

GameResultSchema.index({ createdAt: -1 }); // Descending index on createdAt
GameResultSchema.index({ today_no: 1 });        // Ascending index on odd

const GameResultModel = model('game_results', GameResultSchema);

export default GameResultModel;