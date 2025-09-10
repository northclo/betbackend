import express from "express";
const router = express.Router();

import gameResultRoute from './result.js';

router.use("/", gameResultRoute);

export default router;
