import mongoose from "mongoose";
const { Schema, model } = mongoose;

const NoticeSchema = new Schema(
  {
    partner_ids: {
      type: [String],
      default: [],
      index: true,
    },
    sender: {
      type: mongoose.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    start_date: {
      type: Date,
      default: null,
      index: true,
    },
    end_date: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

NoticeSchema.index({ partner_ids: 1, createdAt: -1 });
NoticeSchema.index({ sender: 1, createdAt: -1 });
NoticeSchema.index({ start_date: 1, end_date: 1 });
NoticeSchema.index({ createdAt: -1 });

const NoticeModel = model("notice", NoticeSchema);

export default NoticeModel;

