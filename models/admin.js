import mongoose from "mongoose";
const { Schema } = mongoose;

const AdminSchema = new Schema(
  {
    firstName: String,
    lastName: String,
    userName: String,
    email: String,
    phoneNumber: String,
    company: String,
    password: String,
  },
  { timestamps: true }
);

const AdminModel = mongoose.model("admin", AdminSchema);

export default AdminModel;
