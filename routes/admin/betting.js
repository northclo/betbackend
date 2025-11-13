import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getBettingList } from "../../controllers/admin/betting/betting-list.js";

router.get("/list", catchError(getBettingList));

export default router;

