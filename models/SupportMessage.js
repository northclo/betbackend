import mongoose from "mongoose";

const SupportMessageSchema = new mongoose.Schema(
  {
    writer: {
      type: mongoose.Types.ObjectId,
      index: true,
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
    first_message_date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    send_date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ip_address: {
      type: String,
      trim: true,
    },
    answer_date: {
      type: Date,
      default: null,
      index: true,
    },
    answerer_id: {
      type: mongoose.Types.ObjectId,
      ref: "partner",
      default: null,
    },
    status: {
      type: String,
      enum: ["NEW", "PENDING", "RESOLVED", "REJECTED"],
      default: "NEW",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

SupportMessageSchema.index({ writer: 1, createdAt: -1 });
SupportMessageSchema.index({ status: 1, createdAt: -1 });
SupportMessageSchema.index({ first_message_date: -1 });
SupportMessageSchema.index({ send_date: -1 });
SupportMessageSchema.index({ answer_date: -1 });
SupportMessageSchema.index({ ip_address: 1 });
SupportMessageSchema.index({ answerer_id: 1 });

export default mongoose.model("SupportMessage", SupportMessageSchema);
