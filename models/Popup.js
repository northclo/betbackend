import mongoose from "mongoose";
const { Schema } = mongoose;

const PopupSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    userId: { type: String, required: true, index: true, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
      index: true,
      lowercase: true,
      trim: true,
    },
    start_date: { type: Date, default: null, index: true },
    end_date: { type: Date, default: null, index: true },
    display_order: { type: Number, default: 0, index: true },
    position: {
      type: String,
      enum: ["top", "center", "bottom", "fullscreen"],
      default: "center",
      trim: true,
    },
    size: {
      type: String,
      enum: ["small", "medium", "large", "fullscreen"],
      default: "medium",
      trim: true,
    },
    is_closable: { type: Boolean, default: true },
    click_count: { type: Number, default: 0 },
    view_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PopupSchema.index({ userId: 1, createdAt: -1 });
PopupSchema.index({ status: 1, start_date: 1, end_date: 1 });
PopupSchema.index({ display_order: 1 });

const PopupModel = mongoose.model("popups", PopupSchema);

export default PopupModel;

