import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getBankAccounts } from "../../controllers/admin/basic/bank-account.js";

router.get("/", catchError(getBankAccounts));

export default router;

