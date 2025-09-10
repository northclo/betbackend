import express from "express";
const router = express.Router();

import getGameResultRoute from './result.js';

router.use('/game-result', getGameResultRoute)

export default router;
