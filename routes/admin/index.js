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
import bettingRoute from "./betting.js";
import chargingRoute from "./charging.js";
import exchangeRoute from "./exchange.js";
import moneyUsageRoute from "./money-usage.js";
import pointUsageRoute from "./point-usage.js";
import announcementRoute from "./announcement.js";
import supportRoute from "./support.js";
import popupRoute from "./popup.js";
import noticeRoute from "./notice.js";
import dashboardRoute from "./dashboard.js";
import bankAccountRoute from "./bank-account.js";
import notificationRoute from "./notification.js";

router.use("/auth", authRoute);
router.use("/member", checkAuth, memberRoute);
router.use("/partner", checkAuth, partnerRoute);
router.use('/game-setting', checkAuth, gameSettingRoute);
router.use('/site-setting', checkAuth, siteSettingRoute);
router.use('/game', checkAuth, gameRoute)
router.use("/account", checkAuth, accountRoute);
router.use("/settlement", checkAuth, settlementRoute);
router.use("/betting", checkAuth, bettingRoute);
router.use("/charging", checkAuth, chargingRoute);
router.use("/exchange", checkAuth, exchangeRoute);
router.use("/money-usage", checkAuth, moneyUsageRoute);
router.use("/point-usage", checkAuth, pointUsageRoute);
router.use("/announcement", checkAuth, announcementRoute);
router.use("/support", checkAuth, supportRoute);
router.use("/popup", checkAuth, popupRoute);
router.use("/notice", checkAuth, noticeRoute);
router.use("/dashboard", checkAuth, dashboardRoute);
router.use("/bank-account", checkAuth, bankAccountRoute);
router.use("/notification", checkAuth, notificationRoute);

export default router;
