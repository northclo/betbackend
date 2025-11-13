import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import {
  getAdminAccount,
  updateAdminAccount,
} from "../../controllers/admin/basic/account.js";

router.get("/", catchError(getAdminAccount));
router.post("/", catchError(updateAdminAccount));

export default router;

