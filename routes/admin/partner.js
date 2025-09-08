import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getPartner, getPartnerList } from "../../controllers/admin/partner/partner.js";
import { getGameSetting, updateGameSetting } from "../../controllers/admin/partner/setting.js";
import { registerUser } from "../../controllers/admin/partner/user.js";
import { sendMessage } from "../../controllers/admin/partner/message.js";

router.get("/", catchError(getPartner));
router.get('/list', catchError(getPartnerList))
router.get('/setting', catchError(getGameSetting));
router.post('/setting', catchError(updateGameSetting));
router.post('/register-user', catchError(registerUser));
router.post("/message", catchError(sendMessage));

export default router;
