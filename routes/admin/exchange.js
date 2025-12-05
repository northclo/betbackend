import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getExchangeList } from "../../controllers/admin/exchange/exchange-list.js";
import { getExchangeSummary } from "../../controllers/admin/exchange/exchange-summary.js";
import { updateExchangeStatus } from "../../controllers/admin/exchange/exchange-action.js";
import { bulkUpdateExchangeStatus } from "../../controllers/admin/exchange/exchange-bulk-action.js";
import { deleteExchangeTransaction } from "../../controllers/admin/exchange/exchange-delete.js";
import { bulkDeleteExchangeTransactions } from "../../controllers/admin/exchange/exchange-bulk-delete.js";
import { updateExchangeComment } from "../../controllers/admin/exchange/exchange-update-comment.js";

router.get("/list", catchError(getExchangeList));
router.get("/summary", catchError(getExchangeSummary));
router.post("/action", catchError(updateExchangeStatus));
router.post("/bulk-action", catchError(bulkUpdateExchangeStatus));
router.post("/bulk-delete", catchError(bulkDeleteExchangeTransactions));
router.put("/:transactionId/comment", catchError(updateExchangeComment));
router.delete("/:id", catchError(deleteExchangeTransaction));

export default router;
