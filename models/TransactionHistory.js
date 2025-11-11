import mongoose from "mongoose";
const { Schema } = mongoose;

const TransactionSchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId },
        action_user: { type: mongoose.Types.ObjectId },
        fund_type: { type: String, enum: ['IMPORT', 'EXCHANGE'] },
        fund_status: { type: String, enum: ['PENDING', 'COMPLETE'] },
        fund_amount: { type: Number, default: 0 },
        payment_method: { type: String, default: 'bank_transfer' }
    },
    { timestamps: true }
);

const TransactionModel = mongoose.model("transaction_history", TransactionSchema);

export default TransactionModel;
