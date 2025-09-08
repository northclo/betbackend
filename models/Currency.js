import mongoose from "mongoose";
const { Schema, model } = mongoose;

const CurrencySchema = new Schema(
    {
        unit: { type: String }
    },
    { timestamps: true }
);

const CurrencyModel = model("currency", CurrencySchema);

export default CurrencyModel;
