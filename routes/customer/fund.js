import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { addFund } from "../../controllers/customer/fund/add.js";
import { withdrawFund } from "../../controllers/customer/fund/withdraw.js";
import { getFundHistory } from "../../controllers/customer/fund/history.js";
import { getWithdrawalHistory } from "../../controllers/customer/fund/withdrawal-history.js";

router.post("/add", catchError(addFund));
router.post("/withdraw", catchError(withdrawFund));
router.get("/history", catchError(getFundHistory));
router.get("/withdrawal-history", catchError(getWithdrawalHistory));

export default router;

