import express from "express";
const router = express.Router();

import authRoute from "./auth.js";
import gameRoute from './game.js';
import fundRoute from './fund.js';
import { checkAuth } from '../../middleware/auth.js'

router.use("/auth", authRoute);
router.use('/game', checkAuth, gameRoute);
router.use('/fund', checkAuth, fundRoute);

export default router;
