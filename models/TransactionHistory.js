import mongoose from "mongoose";
const { Schema } = mongoose;

const TransactionSchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId },
        fund_type: { type: String, enum: ['CHARGE', 'EXCHANGE', 'BETTING', 'PARTNER_INCREASE', 'PARTNER_DECREASE'] },
        fund_status: { type: String, enum: ['WAIT', 'COMPLETE', 'CANCEL'], default: 'WAIT' },
        fund_amount: { type: Number, default: 0 },
        action_user_id: { type: mongoose.Types.ObjectId, default: null },
        request_send_date: { type: Date, default: Date.now },
        fund_status_update_date: { type: Date, default: null },
        comment: { type: String, default: null },
        updated_amount: { type: Number, default: null }
    },
    { timestamps: true }
);

TransactionSchema.index({ fund_type: 1, fund_status: 1, createdAt: -1 });

const TransactionModel = mongoose.model("transaction_history", TransactionSchema);

export default TransactionModel;
