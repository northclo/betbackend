import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getPointUsageList } from "../../controllers/admin/point-usage/point-usage-list.js";
import { getPointUsageSummary } from "../../controllers/admin/point-usage/point-usage-summary.js";
import { deletePointUsageTransaction } from "../../controllers/admin/point-usage/point-usage-delete.js";
import { bulkDeletePointUsageTransactions } from "../../controllers/admin/point-usage/point-usage-bulk-delete.js";

router.get("/list", catchError(getPointUsageList));
router.get("/summary", catchError(getPointUsageSummary));
router.post("/bulk-delete", catchError(bulkDeletePointUsageTransactions));
router.delete("/:id", catchError(deletePointUsageTransaction));

export default router;

