import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { login } from "../../controllers/admin/auth/login.js";

router.post("/", catchError(login));

export default router;
