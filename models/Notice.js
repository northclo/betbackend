import mongoose from "mongoose";
const { Schema, model } = mongoose;

const NoticeSchema = new Schema(
  {
    partner_ids: {
      type: [mongoose.Types.ObjectId],
      default: [],
      index: true,
    },
    writer: {
      type: mongoose.Types.ObjectId,
      ref: "partner",
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
  },
  { timestamps: true }
);

NoticeSchema.index({ partner_ids: 1, createdAt: -1 });
NoticeSchema.index({ writer: 1, createdAt: -1 });
NoticeSchema.index({ createdAt: -1 });

const NoticeModel = model("notice", NoticeSchema);

export default NoticeModel;

