import mongoose from "mongoose";
const { Schema, model } = mongoose;

const BankAccountSchema = new Schema(
    {
        bank_name: { type: String,
        required: true,
        unique: true,
        index: true
    }
    },
    { timestamps: true }
);

const BankAccountModel = model("bank_account", BankAccountSchema);

export default BankAccountModel;

