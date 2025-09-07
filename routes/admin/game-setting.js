import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getGameSetting, updateGameSetting } from "../../controllers/admin/partner/setting.js";

router.get("/", catchError(getGameSetting));
router.post('/', catchError(updateGameSetting))

export default router;
