import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getSiteSetting, updateSiteSetting } from "../../controllers/admin/basic/site-setting.js";

router.get("/", catchError(getSiteSetting));
router.post('/', catchError(updateSiteSetting));

export default router;
