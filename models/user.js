import mongoose from "mongoose";
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    firstName: { type: String, index: true },
    lastName: { type: String, index: true },
    userName: { type: String, index: true },
    email: { type: String, index: true },
    phoneNumber: { type: String, index: true },
    company: { type: String, index: true },
    password: String,
  },
  { timestamps: true }
);

const UserModel = mongoose.model("user", UserSchema);

export default UserModel;
