import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import {
  createBlogPost,
  deleteBlogPost,
  listBlogPosts,
  updateBlogPost,
} from "../../controllers/customer/blog/posts.js";

router.get("/posts", catchError(listBlogPosts));
router.post("/posts", catchError(createBlogPost));
router.put("/posts/:postId", catchError(updateBlogPost));
router.delete("/posts/:postId", catchError(deleteBlogPost));

export default router;


