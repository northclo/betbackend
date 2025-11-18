import mongoose from "mongoose";
const { Schema } = mongoose;

const AnnouncementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true, trim: true },
    userId: { type: String, required: true, index: true, trim: true },
    category: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived", "hidden"],
      default: "draft",
      index: true,
      lowercase: true,
      trim: true,
    },
    published_at: { type: Date, default: new Date() },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ userId: 1, createdAt: -1 });
AnnouncementSchema.index({ status: 1, published_at: -1 });
AnnouncementSchema.index({ slug: 1 });

const AnnouncementModel = mongoose.model("announcements", AnnouncementSchema);

export default AnnouncementModel;

