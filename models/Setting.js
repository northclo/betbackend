import mongoose from "mongoose";
const { Schema } = mongoose;

const SettingSchema = new Schema(
    {
        siteActivation: {
            allow: { type: Boolean, default: true },
            disable: { type: Number, default: 0 },
            deactiveMessage: { type: String },
        },
        siteSecurity: { type: Boolean, default: true },
        siteText: {
            name: { type: String },
            titlebar: { type: String },
            copywriter: { type: String },
            topNotificationMessage: { type: String },
            depositAccount: { type: String },
        },
        membership: {
            registration: { type: Number, default: 0 },
            approval: { type: Boolean, default: true },
            message: { type: String },
        },
        charge: {
            minAmount: { type: Number },
            maxAmount: { type: Number },
            timezoneAvailable: { type: Boolean },
            startTime: { type: Number },
            endTime: { type: Number },
            impossibleMessage: { type: String },
            completeMessage: { type: String }
        },
        exchange: {
            minAmount: { type: Number },
            maxAmount: { type: Number },
            timezoneAvailable: { type: Boolean },
            startTime: { type: Number },
            endTime: { type: Number },
            impossibleMessage: { type: String },
            restriction: { type: Number, default: 0 },
            restrictionExchange: { type: Boolean, default: true },
            restrictionExchangeLimit: { type: Number },
            restrictionCharge: { type: Boolean, default: true },
            restrictionChargeLimit: { type: Number },
            completeMessage: { type: String }
        },
        customerCenter: { type: Boolean, default: true }
    },
    { timestamps: true }
);

const SettingModel = mongoose.model("setting", SettingSchema);

export default SettingModel;
