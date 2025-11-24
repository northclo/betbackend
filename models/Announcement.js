import mongoose from "mongoose";
const { Schema } = mongoose;

const AnnouncementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    author: {
      type: mongoose.Types.ObjectId,
      ref: "partner",
      required: true,
      index: true,
    },
    category: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived", "hidden"],
      default: "draft",
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ author: 1, createdAt: -1 });
AnnouncementSchema.index({ status: 1, createdAt: -1 });

const AnnouncementModel = mongoose.model("announcements", AnnouncementSchema);

export default AnnouncementModel;

