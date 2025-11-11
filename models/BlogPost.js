import mongoose from "mongoose";
const { Schema } = mongoose;

const BlogPostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true, trim: true },
    image: { type: String, trim: true },
    userId: { type: String, required: true, index: true, trim: true },
    category: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
      lowercase: true,
      trim: true,
    },
    published_at: { type: Date, default: null },
  },
  { timestamps: true }
);

BlogPostSchema.index({ userId: 1, createdAt: -1 });
BlogPostSchema.index({ status: 1, published_at: -1 });
BlogPostSchema.index({ slug: 1 });

const BlogPostModel = mongoose.model("blog_posts", BlogPostSchema);

export default BlogPostModel;


