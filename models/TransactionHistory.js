import mongoose from "mongoose";
const { Schema } = mongoose;

const TransactionSchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId },
        fund_type: { type: String, enum: ['IMPORT', 'OUTGOING', 'EXCHANGE'] },
        fund_status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] },
        fund_amount: { type: Number, default: 0 },
        currency: { type: String, default: null },
        from_currency: { type: String, default: null },
        to_currency: { type: String, default: null },
        exchange_rate: { type: Number, default: null },
        original_amount: { type: Number, default: null },
        processed_by: { type: mongoose.Types.ObjectId, default: null },
        processed_at: { type: Date, default: null }
    },
    { timestamps: true }
);

TransactionSchema.index({ fund_type: 1, fund_status: 1, createdAt: -1 });
TransactionSchema.index({ fund_type: 1, createdAt: -1 });

const TransactionModel = mongoose.model("transaction_history", TransactionSchema);

export default TransactionModel;
