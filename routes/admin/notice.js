import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import {
  listNotices,
} from "../../controllers/admin/notice/notice-list.js";
import {
  createNotice,
} from "../../controllers/admin/notice/notice-create.js";
import {
  updateNotice,
} from "../../controllers/admin/notice/notice-update.js";
import {
  deleteNotice,
} from "../../controllers/admin/notice/notice-delete.js";

router.get("/list", catchError(listNotices));
router.post("/", catchError(createNotice));
router.put("/:noticeId", catchError(updateNotice));
router.delete("/:noticeId", catchError(deleteNotice));

export default router;

