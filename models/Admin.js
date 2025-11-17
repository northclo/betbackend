import mongoose from "mongoose";
const { Schema, model } = mongoose;

const AdminSchema = new Schema(
    {
        admin_id: { 
            type: String, 
            required: true, 
            unique: true,
            trim: true
        },
        admin_nickname: {
            type: String,
            required: true
        },
        password: { 
            type: String, 
            required: true 
        },
        password_change_time: { 
            type: Date 
        },
        view_manager_id: { 
            type: String, 
            unique: true, 
            sparse: true 
        },
        view_manager_password: { 
            type: String 
        },
        view_manager_password_change_time: { 
            type: Date 
        },
        partner_id: { 
            type: mongoose.Types.ObjectId,
            ref: "partner"
        },
        is_active: {
            type: Boolean,
            default: true
        },
        last_login: {
            type: Number
        }
    },
    { timestamps: true }
);

const AdminModel = model("admin", AdminSchema);

export default AdminModel;

