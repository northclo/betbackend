import express from "express";

import { catchError } from "../../middleware/error.js";
import { getBettingSettlementProfit } from "../../controllers/admin/settlement/betting-settlement.js";

const router = express.Router();

router.get("/betting-profit", catchError(getBettingSettlementProfit));

export default router;

