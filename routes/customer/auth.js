import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { checkAuth } from "../../middleware/auth.js";
import { login } from "../../controllers/customer/auth/login.js";
import { register } from "../../controllers/customer/auth/register.js";
import { getCaptcha } from "../../controllers/admin/auth/captcha.js";
import { getUserInfo } from "../../controllers/customer/auth/get-user-info.js";

router.post("/", catchError(login));
router.post("/register", catchError(register));
router.get('/captcha', catchError(getCaptcha));
router.get('/user-info', checkAuth, catchError(getUserInfo));

export default router;
