import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import {
  listBankAccounts,
} from "../../controllers/admin/bank-account/bank-account-list.js";
import {
  createBankAccount,
} from "../../controllers/admin/bank-account/bank-account-create.js";
import {
  updateBankAccount,
} from "../../controllers/admin/bank-account/bank-account-update.js";
import {
  deleteBankAccount,
} from "../../controllers/admin/bank-account/bank-account-delete.js";

router.get("/list", catchError(listBankAccounts));
router.post("/", catchError(createBankAccount));
router.put("/:bankAccountId", catchError(updateBankAccount));
router.delete("/:bankAccountId", catchError(deleteBankAccount));

export default router;

