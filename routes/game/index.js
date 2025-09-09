import express from "express";
const router = express.Router();

import gameResultRoute from './result.js';
import getGameResultRoute from './game-result.js';
// App api
router.use("/", gameResultRoute);
router.use('/game-result', getGameResultRoute)

export default router;
