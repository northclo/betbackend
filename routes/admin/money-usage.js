import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getMoneyUsageList } from "../../controllers/admin/money-usage/money-usage-list.js";
import { getMoneyUsageSummary } from "../../controllers/admin/money-usage/money-usage-summary.js";
import { deleteMoneyUsageTransaction } from "../../controllers/admin/money-usage/money-usage-delete.js";

router.get("/list", catchError(getMoneyUsageList));
router.get("/summary", catchError(getMoneyUsageSummary));
router.delete("/:id", catchError(deleteMoneyUsageTransaction));

export default router;

