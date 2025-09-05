import mongoose from "mongoose";
import { partnerType } from "../const/type.js";
const { Schema, model } = mongoose;

const PartnerSchema = new Schema(
    {
        role: {
            type: String,
            enum: [partnerType.headquater, partnerType.branchOffice, partnerType.regionalOffice, partnerType.agency, partnerType.distributor, partnerType.store],
            default: partnerType.headquater
        },
        user_id: { type: String },
        sub_partner_id: { type: String },
        currency_rolling: { type: Boolean, default: true },
        deposit_approved_amount: { type: Number, default: 0 },
        dashboard_access_permission: { type: Boolean, default: false },
        sub_partner_creation_permission: { type: Boolean, default: false },
        user_creation_permission: { type: Boolean, default: false },
        sub_partner_settlement_rate: { type: Boolean, default: false },
        sub_partner_money_change: { type: Boolean, default: false },
        bet_rate_type: { type: String },
        deadline: { type: Number },
        cancel_bet: { type: Boolean, default: false },
        cancel_bet_range: {
            end_time: { type: Number },
            max_time: { type: Number },
            perday_time: { type: Number }
        },
        bet_money_unit: { type: String },
        onetime_bet_max: { type: Number },
        onetime_bet_min: { type: Number },
        onetime_earning_min: { type: Number },
        onetime_earning_max: { type: Number },
        oneround_bet_max: { type: Number }
    },
    { timestamps: true }
);

const PartnerModel = model("partner", PartnerSchema);

export default PartnerModel;
