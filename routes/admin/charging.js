import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getChargingList } from "../../controllers/admin/charging/charging-list.js";
import { getChargingSummary } from "../../controllers/admin/charging/charging-summary.js";
import { updateChargingStatus } from "../../controllers/admin/charging/charging-action.js";
import { bulkUpdateChargingStatus } from "../../controllers/admin/charging/charging-bulk-action.js";
import { deleteChargingTransaction } from "../../controllers/admin/charging/charging-delete.js";
import { bulkDeleteChargingTransactions } from "../../controllers/admin/charging/charging-bulk-delete.js";
import { updateChargingComment } from "../../controllers/admin/charging/charging-update-comment.js";

router.get("/list", catchError(getChargingList));
router.get("/summary", catchError(getChargingSummary));
router.post("/action", catchError(updateChargingStatus));
router.post("/bulk-action", catchError(bulkUpdateChargingStatus));
router.post("/bulk-delete", catchError(bulkDeleteChargingTransactions));
router.put("/:transactionId/comment", catchError(updateChargingComment));
router.delete("/:id", catchError(deleteChargingTransaction));

export default router;

