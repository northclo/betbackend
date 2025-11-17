import express from "express";
const router = express.Router();

import { checkAuth } from "../../middleware/auth.js";
import { catchError } from "../../middleware/error.js";
import { getNoticeList } from "../../controllers/customer/notice/notice-list.js";

router.get("/list", checkAuth, catchError(getNoticeList));

export default router;

