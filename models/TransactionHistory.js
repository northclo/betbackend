import mongoose from "mongoose";
const { Schema } = mongoose;

const TransactionSchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId },
        fund_type: { type: String, enum: ['IMPORT', 'OUTGOING'] },
        fund_status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] },
        fund_amount: { type: Number, default: 0 }
    },
    { timestamps: true }
);

const TransactionModel = mongoose.model("transaction_history", TransactionSchema);

export default TransactionModel;
