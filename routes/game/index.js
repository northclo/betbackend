import express from "express";
const router = express.Router();

import getGameResultRoute from './result.js';
// App api
router.use('/game-result', getGameResultRoute)

export default router;
