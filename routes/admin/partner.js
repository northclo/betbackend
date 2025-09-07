import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getPartner } from "../../controllers/admin/partner/partner.js";

router.get("/", catchError(getPartner));

export default router;
