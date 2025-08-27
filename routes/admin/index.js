import express from "express";
const router = express.Router();

import authRoute from "./auth.js";

// App api
router.use("/auth", authRoute);

export default router;
