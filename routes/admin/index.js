import express from "express";
const router = express.Router();

import { checkAuth } from "../../middleware/auth.js";
import authRoute from "./auth.js";
import partnerRoute from './partner.js';
import memberRoute from "./member.js";
import gameSettingRoute from './game-setting.js';
import siteSettingRoute from './site-setting.js';
import gameRoute from './game.js'
import settlementRoute from "./settlement.js";
import accountRoute from "./account.js";

router.use("/auth", authRoute);
router.use("/member", checkAuth, memberRoute);
router.use("/partner", checkAuth, partnerRoute);
router.use('/game-setting', checkAuth, gameSettingRoute);
router.use('/site-setting', checkAuth, siteSettingRoute);
router.use('/game', checkAuth, gameRoute)
router.use("/account", checkAuth, accountRoute);
router.use("/settlement", checkAuth, settlementRoute);

export default router;
