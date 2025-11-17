import express from "express";
const router = express.Router();

import authRoute from "./auth.js";
import gameRoute from './game.js';
import fundRoute from './fund.js';
import supportRoute from './support.js';
import noticeRoute from './notice.js';
import { checkAuth } from '../../middleware/auth.js'

router.use("/auth", authRoute);
router.use('/support', supportRoute);
router.use('/game', checkAuth, gameRoute);
router.use('/fund', checkAuth, fundRoute);
router.use('/notice', noticeRoute);

export default router;
