import express from "express";
const router = express.Router();


import getGameResultRoute from './game-result.js';
// App api
router.use('/game-result', getGameResultRoute)

export default router;
