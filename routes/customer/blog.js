import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import {
  createBlogPost,
  deleteBlogPost,
  listBlogPosts,
  updateBlogPost,
} from "../../controllers/customer/blog/posts.js";
import upload from "../../middleware/upload.js";

router.get("/posts", catchError(listBlogPosts));
router.post("/posts", upload.single("image"), catchError(createBlogPost));
router.put("/posts/:postId", upload.single("image"), catchError(updateBlogPost));
router.delete("/posts/:postId", catchError(deleteBlogPost));

export default router;


