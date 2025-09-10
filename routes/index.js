import express from "express";
const router = express.Router();

import pushGameResultRoute from './game/result.js';

// game Request
router.use('/', pushGameResultRoute);

export default router;
