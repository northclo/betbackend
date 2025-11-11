import express from "express";
const router = express.Router();

import authRoute from "./auth.js";
import gameRoute from './game.js';
import fundRoute from './fund.js';
<<<<<<< HEAD
import blogRoute from './blog.js';
import supportRoute from './support.js';
=======
>>>>>>> bd6a6754bcdb196af34d5e53ac20a2979b65f92b
import { checkAuth } from '../../middleware/auth.js'

router.use("/auth", authRoute);
router.use('/support', supportRoute);
router.use('/game', checkAuth, gameRoute);
router.use('/fund', checkAuth, fundRoute);
<<<<<<< HEAD
router.use('/blog', checkAuth, blogRoute);
=======
>>>>>>> bd6a6754bcdb196af34d5e53ac20a2979b65f92b

export default router;
