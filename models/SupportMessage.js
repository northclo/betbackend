import mongoose from "mongoose";

const SupportMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "user",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open",
      index: true,
      lowercase: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true,
      lowercase: true,
      trim: true,
    },
    assigned_to: {
      type: String,
      trim: true,
      default: null,
    },
    replies: [
      {
        message: {
          type: String,
          required: true,
          trim: true,
        },
        replied_by: {
          type: String,
          required: true,
          trim: true,
        },
        replied_by_name: {
          type: String,
          trim: true,
        },
        is_admin: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

SupportMessageSchema.index({ userId: 1, createdAt: -1 });
SupportMessageSchema.index({ status: 1, createdAt: -1 });
SupportMessageSchema.index({ priority: 1, createdAt: -1 });
SupportMessageSchema.index({ assigned_to: 1 });

export default mongoose.model("SupportMessage", SupportMessageSchema);
