import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getExchangeList } from "../../controllers/admin/exchange/exchange-list.js";
import { getExchangeSummary } from "../../controllers/admin/exchange/exchange-summary.js";
import { updateExchangeStatus } from "../../controllers/admin/exchange/exchange-action.js";

router.get("/list", catchError(getExchangeList));
router.get("/summary", catchError(getExchangeSummary));
router.post("/action", catchError(updateExchangeStatus));

export default router;
