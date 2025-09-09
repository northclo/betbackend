import express from "express";
const router = express.Router();

import gameResultRoute from './result.js';
// App api
router.use("/", gameResultRoute);

export default router;
