import mongoose from "mongoose";
const { Schema } = mongoose;

const AdminSchema = new Schema(
  {
    email: String,
    password: String,
    token: String,
  },
  { timestamps: true }
);

const AdminModel = mongoose.model("admin", AdminSchema);

export default AdminModel;
