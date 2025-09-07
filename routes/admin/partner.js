import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getPartner, getPartnerList } from "../../controllers/admin/partner/partner.js";
import { getGameSetting, updateGameSetting } from "../../controllers/admin/partner/setting.js";

router.get("/", catchError(getPartner));
router.get('/list', catchError(getPartnerList))
router.get('/setting', catchError(getGameSetting));
router.post('/setting', catchError(updateGameSetting))

export default router;
