import mongoose from "mongoose";
const { Schema } = mongoose;

const PopupSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    author: { type: String, required: true, index: true, trim: true },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "INACTIVE",
      trim: true,
    },
  },
  { timestamps: true }
);

PopupSchema.index({ author: 1, createdAt: -1 });
PopupSchema.index({ status: 1 });

const PopupModel = mongoose.model("popups", PopupSchema);

export default PopupModel;

