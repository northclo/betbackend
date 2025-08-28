import express from "express";
const router = express.Router();

import { checkAuth } from "../../middleware/auth.js";
import authRoute from "./auth.js";
import memberRoute from "./member.js";

router.use("/auth", authRoute);
router.use("/member", checkAuth, memberRoute);

export default router;
