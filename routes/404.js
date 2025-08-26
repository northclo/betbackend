import express from "express";
const router = express.Router();

import { catchError } from "../middleware/error.js";
import { notFound } from "../controllers/404.js";

router.use(catchError(notFound));

export default router;
