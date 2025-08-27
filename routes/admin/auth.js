import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { login } from "../../controllers/admin/auth/login.js";
import { forgotPassword } from "../../controllers/admin/auth/forgot-password.js";
import { resetPassword } from "../../controllers/admin/auth/reset-password.js";

router.post("/", catchError(login));
router.post("/forgot-password", catchError(forgotPassword));
router.post("/reset-password/:token", catchError(resetPassword));

export default router;
