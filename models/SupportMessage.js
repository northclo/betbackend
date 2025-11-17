import mongoose from "mongoose";

const SupportMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "user",
      index: true,
    },
    user_nickname: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      trim: true,
      default: "",
    },
    firstMessageDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    sendDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    answerDate: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "resolved", "rejected"],
      default: "pending",
      index: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

SupportMessageSchema.index({ userId: 1, createdAt: -1 });
SupportMessageSchema.index({ status: 1, createdAt: -1 });
SupportMessageSchema.index({ firstMessageDate: -1 });
SupportMessageSchema.index({ sendDate: -1 });
SupportMessageSchema.index({ answerDate: -1 });
SupportMessageSchema.index({ ipAddress: 1 });

export default mongoose.model("SupportMessage", SupportMessageSchema);
