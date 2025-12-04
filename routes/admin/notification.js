import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getChargeNotification } from "../../controllers/admin/notification/charge-notification.js";
import { getExchangeNotification } from "../../controllers/admin/notification/exchange-notification.js";
import { getCustomNotification } from "../../controllers/admin/notification/custom-notification.js";
import { getAlarmSettings, updateAlarmSettings } from "../../controllers/admin/notification/alarm-settings.js";

router.get("/charge", catchError(getChargeNotification));
router.get("/exchange", catchError(getExchangeNotification));
router.get("/custom", catchError(getCustomNotification));
router.get("/alarm-settings", catchError(getAlarmSettings));
router.post("/alarm-settings", catchError(updateAlarmSettings));

export default router;

