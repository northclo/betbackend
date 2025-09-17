import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { login } from "../../controllers/customer/auth/login.js";
import { getCaptcha } from "../../controllers/admin/auth/captcha.js";

router.post("/", catchError(login));
router.get('/captcha', catchError(getCaptcha))

export default router;
