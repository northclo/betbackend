import mongoose from "mongoose";
import { partnerType } from "../const/type.js";
import { userStatus } from "../const/status.js";
const { Schema, model } = mongoose;

const PartnerSchema = new Schema(
    {
        role: {
            type: String,
            enum: [partnerType.headquater, partnerType.branchOffice, partnerType.regionalOffice, partnerType.agency, partnerType.distributor, partnerType.store],
            default: partnerType.headquater
        },
        nickname: { type: String, required: true, unique: true, index: true },
        partner_id: { type: String, required: true, unique: true, index: true },
        password: { type: String, required: true },
        exchange_secure_number: { type: String, required: true },
        phone_number: {
            active_code: { type: String },
            phone_number_1: { type: String },
            phone_number_2: { type: String }
        },
        bank_id: { type: mongoose.Types.ObjectId },
        bank_number: { type: String, required: true },
        bank_owner_name: { type: String, required: true },
        simple_bet_rate: { type: Number, default: 0 },
        combined_bet_rate: { type: Number, default: 0 },
        match_num_bet_rate: { type: Number, default: 0 },
        parent_partner_id: { type: mongoose.Types.ObjectId },
        user_id: { type: mongoose.Types.ObjectId },
        currency_rolling: { type: Boolean, default: true },
        rollover_percentage: { type: Number, default: 0 },
        own_money: { type: Number, default: 0 },
        point: { type: Number, default: 0 },
        partner_access_permission: { type: Boolean, default: false },
        sub_partner_creation_permission: { type: Boolean, default: false },
        user_creation_permission: { type: Boolean, default: false },
        sub_partner_settlement_rate: { type: Boolean, default: false },
        sub_partner_money_change: { type: Boolean, default: false },
        bet_rate_type: { type: String, enum: ['A', 'B'], default: 'A' },
        deadline: { type: Number },
        cancel_bet: { type: Boolean, default: true },
        cancel_bet_range: {
            end_time: { type: Number },
            max_time: { type: Number },
            perday_time: { type: Number }
        },
        bet_money_unit: { type: String },
        onetime_bet_max: { type: Number },
        onetime_bet_min: { type: Number, default: 0 },
        onetime_earning_min: { type: Number, default: 0 },
        onetime_earning_max: { type: Number },
        oneround_bet_max: { type: Number },
        oneround_earning_max: { type: Number },
        oneround_bet_max_slot: { type: Number },
        oneround_earning_max_slot: { type: Number },
        all_rounds_bet_max: { type: Number },
        all_rounds_bet_max_by_slots: [
            {
                bet_type: { 
                    type: String, 
                    enum: ['oedv', 'unov', 'oeuo', 'match_1_3', 'match_1_4', 'match_1_6'],
                    required: true
                },
                slot_bet_max: { type: Number, min: 0, default: 0 },
                public: { type: Boolean, default: false }
            }
        ],
        user_status: {
            type: String,
            enum: [userStatus.wait, userStatus.normal, userStatus.stop, userStatus.cancel, userStatus.danger, userStatus.tester],
            default: userStatus.normal
        },
        consider_user: { type: Boolean, default: false }
    },
    { timestamps: true }
);

const PartnerModel = model("partner", PartnerSchema);

export default PartnerModel;
