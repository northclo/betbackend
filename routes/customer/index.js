import express from "express";
const router = express.Router();

import authRoute from "./auth.js";
import gameRoute from './game.js';
import { checkAuth } from '../../middleware/auth.js'

// App api
router.use("/auth", authRoute);
router.use('/game', checkAuth, gameRoute);

export default router;
