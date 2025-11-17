import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getSiteSetting } from "../../controllers/customer/basic/site-setting.js";

router.get("/site-setting", catchError(getSiteSetting));

export default router;

