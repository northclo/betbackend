import mongoose from "mongoose";
const { Schema } = mongoose;

const PointTransactionSchema = new Schema(
    {
        user_id: { type: mongoose.Types.ObjectId, required: true },
        point_type: { type: String, enum: ['EARN', 'SPEND'], required: true },
        point_amount: { type: Number, required: true },
        balance_after: { type: Number, required: true },
        description: { type: String, default: "" },
        reference_id: { type: mongoose.Types.ObjectId, default: null },
        reference_type: { type: String, default: null }
    },
    { timestamps: true }
);

const PointTransactionModel = mongoose.model("point_transaction", PointTransactionSchema);

export default PointTransactionModel;

