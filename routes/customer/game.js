import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getGameInitInfo } from "../../controllers/customer/game/init.js";
import { getGameOption } from "../../controllers/customer/game/init-option.js";
import { StartGame } from "../../controllers/customer/game/start.js";
import { cancelGame } from "../../controllers/customer/game/cancel.js";
import { getBettingHistory } from "../../controllers/customer/game/history.js";

router.get('/', catchError(getGameInitInfo));
router.get('/option', catchError(getGameOption));
router.get('/history', catchError(getBettingHistory));
router.post('/start', catchError(StartGame));
router.post('/cancel', catchError(cancelGame));

export default router;
