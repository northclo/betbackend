import express from "express";
const router = express.Router();

import customerRoute from "./customer/index.js";
import notFoundRouter from "./404.js";

// App api
router.use("/customer", customerRoute);
router.use(notFoundRouter);

export default router;
