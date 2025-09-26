import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getGameInitInfo } from "../../controllers/customer/game/init.js";
import { StartGame } from "../../controllers/customer/game/start.js";
import { cancelGame } from "../../controllers/customer/game/cancel.js";
import { getGameResult } from "../../controllers/customer/game/get-result.js";

router.get('/', catchError(getGameInitInfo));
router.post('/start', catchError(StartGame));
router.post('/cancel', catchError(cancelGame));
router.get('/result', catchError(getGameResult))

export default router;
