import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getChargingList } from "../../controllers/admin/charging/charging-list.js";
import { getChargingSummary } from "../../controllers/admin/charging/charging-summary.js";
import { updateChargingStatus } from "../../controllers/admin/charging/charging-action.js";
import { deleteChargingTransaction } from "../../controllers/admin/charging/charging-delete.js";

router.get("/list", catchError(getChargingList));
router.get("/summary", catchError(getChargingSummary));
router.post("/action", catchError(updateChargingStatus));
router.delete("/:id", catchError(deleteChargingTransaction));

export default router;

