import mongoose from "mongoose";
const { Schema } = mongoose;

const UserSchema = new Schema(
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

const UserModel = mongoose.model("user", UserSchema);

export default UserModel;
