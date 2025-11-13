import mongoose from "mongoose";
const { Schema } = mongoose;

const TransactionSchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId },
        fund_type: { type: String, enum: ['IMPORT', 'OUTGOING', 'EXCHANGE'] },
        fund_status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] },
        fund_amount: { type: Number, default: 0 },
        processed_by: { type: mongoose.Types.ObjectId, default: null },
        processed_at: { type: Date, default: null }
    },
    { timestamps: true }
);

const TransactionModel = mongoose.model("transaction_history", TransactionSchema);

export default TransactionModel;
