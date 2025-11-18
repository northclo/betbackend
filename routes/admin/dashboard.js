import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getMonthlyLoggedInUsers, getMonthlyChargeAndExchange, getDashboardSummary, getSidebarSummary } from "../../controllers/admin/dashboard/dashboard-stats.js";

router.get("/summary", catchError(getDashboardSummary));
router.get("/loggedin-users", catchError(getMonthlyLoggedInUsers));
router.get("/charge-exchange", catchError(getMonthlyChargeAndExchange));
router.get("/sidebar-summary", catchError(getSidebarSummary));

export default router;

