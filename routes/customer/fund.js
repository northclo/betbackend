import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { addFund } from "../../controllers/customer/fund/add.js";
import { exchangeFund } from "../../controllers/customer/fund/exchange.js";
import { getFundHistory } from "../../controllers/customer/fund/history.js";
import { cancelFund } from "../../controllers/customer/fund/cancel.js";
import { getExchangeHistory } from "../../controllers/customer/fund/exchange-history.js";
import { cancelExchange } from "../../controllers/customer/fund/cancel-exchange.js";

router.post("/add", catchError(addFund));
router.post("/exchange", catchError(exchangeFund));
router.post("/cancel", catchError(cancelFund));
router.post("/cancel-exchange", catchError(cancelExchange));
router.get("/history", catchError(getFundHistory));
router.get("/exchange-history", catchError(getExchangeHistory));

export default router;

