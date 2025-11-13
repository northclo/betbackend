import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getPointUsageList } from "../../controllers/admin/point-usage/point-usage-list.js";
import { getPointUsageSummary } from "../../controllers/admin/point-usage/point-usage-summary.js";

router.get("/list", catchError(getPointUsageList));
router.get("/summary", catchError(getPointUsageSummary));

export default router;

