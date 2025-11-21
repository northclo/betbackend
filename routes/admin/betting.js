import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getBettingList } from "../../controllers/admin/betting/betting-list.js";
import { bulkDeleteBettingList } from "../../controllers/admin/betting/betting-bulk-delete.js";

router.get("/list", catchError(getBettingList));
router.post("/bulk-delete", catchError(bulkDeleteBettingList));

export default router;

