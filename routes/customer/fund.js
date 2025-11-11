import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { addFund } from "../../controllers/customer/fund/add.js";
import { withdrawFund } from "../../controllers/customer/fund/withdraw.js";

router.post("/add", catchError(addFund));
router.post("/withdraw", catchError(withdrawFund));

export default router;

