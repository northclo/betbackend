import mongoose from "mongoose";
const { Schema } = mongoose;

const AdminSchema = new Schema(
    {
        siteActivation: { type: Boolean, default: true },
        siteDisable: { type: Number, default: 0 },
        siteDeactiveMessage: { type: String },
        siteSecurity: { type: Boolean, default: true },
        siteName: { type: String },
        siteTitlebar: { type: String },
        siteCopywriter: { type: String },
        siteTopNotificationMessage: { type: String },
        siteDepositAccount: { type: String },
        membershipRegistration: { type: Number, default: 0 },
        membershipRegistrationApproval: { type: Boolean, default: true },
        membershipMessage: { type: String },
        exchangeMinAmount: { type: Number },
        exchangeMaxAmount: { type: Number },
        exchangeTimezomeAvailable: { type: Boolean },
    },
    { timestamps: true }
);

const AdminModel = mongoose.model("admin", AdminSchema);

export default AdminModel;
