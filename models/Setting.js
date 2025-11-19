import mongoose from "mongoose";
import { siteDisableType, membershipType, exchangeRestrictionType } from "../const/type.js";
const { Schema } = mongoose;

const SettingSchema = new Schema(
    {
        site_activation: { type: Boolean, default: true },
        disable_style: {
            type: String,
            enum: [siteDisableType.simple_text, siteDisableType.login_box, siteDisableType.page_not_found],
            default: siteDisableType.simple_text
        },
        deactive_message: { type: String },
        security: { type: Boolean, default: true },
        site_name: { type: String },
        title_bar: { type: String },
        copywriter: { type: String },
        top_notify_message: { type: String },
        deposit_account: { type: String },
        membership_registration: {
            type: String,
            enum: [membershipType.recommender, membershipType.select_referrer, membershipType.no_referrer, membershipType.no_use],
            default: membershipType.recommender
        },
        membership_approval: { type: Boolean, default: true },
        membership_signup_message: { type: String },
        charge_min: { type: Number },
        charge_max: { type: Number },
        charge_timezone: { type: Boolean, default: false },
        charge_start_time: { type: Number },
        charge_end_time: { type: Number },
        charge_impossible_timezone_message: { type: String },
        charge_complete_message: { type: String },
        exchange_min: { type: Number },
        exchange_max: { type: Number },
        exchange_timezone: { type: Boolean, default: false },
        exchange_start_time: { type: Number },
        exchange_end_time: { type: Number },
        exchange_impossible_timezone_message: { type: String },
        exchange_restriction: {
            type: String,
            enum: [exchangeRestrictionType.impossible, exchangeRestrictionType.request, exchangeRestrictionType.allow],
            default: exchangeRestrictionType.impossible
        },
        exchange_restriction_use: { type: Boolean, default: false },
        exchange_restriction_limit: { type: Number },
        charge_restriction_use: { type: Boolean, default: false },
        charge_restriction_limit: { type: Number },
        exchange_complete_message: { type: String },
        customer_center: { type: Boolean, default: true },
        deposit_banks: { type: [String], default: [] },
    },
    { timestamps: true }
);

const SettingModel = mongoose.model("setting", SettingSchema);

export default SettingModel;
