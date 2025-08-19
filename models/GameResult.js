import mongoose from "mongoose";
const { Schema, model } = mongoose;

const GameResultSchema = new Schema({
    list: [Number],
    round_id: Number,
    today_no: Number,
    current_no: Number,
    time_stamp: Number,
    game_id: String,
    device_id: String,
    odd: Boolean,
    under: Boolean
},
{ timestamps: true }
);

GameResultSchema.index({ createdAt: -1 }); // Descending index on createdAt
GameResultSchema.index({ odd: 1 });        // Ascending index on odd
GameResultSchema.index({ under: 1 });      // Ascending index on under
GameResultSchema.index({ odd: 1, under: 1 }); // Compound index for queries like { odd: true, under: false }

const GameResults = mongoose.model('game_results', GameResultSchema);

export default GameResults;