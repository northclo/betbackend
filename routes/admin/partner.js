import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getPartner, getPartnerList, deletePartner, increaseCash } from "../../controllers/admin/partner/partner.js";
import { registerUser } from "../../controllers/admin/partner/user.js";
import { registerPartner } from "../../controllers/admin/partner/register-partner.js";
import { sendMessage } from "../../controllers/admin/partner/message.js";

router.get("/", catchError(getPartner));
router.get('/list', catchError(getPartnerList));
router.post('/register-user', catchError(registerUser));
router.post('/register-partner', catchError(registerPartner));
router.post("/message", catchError(sendMessage));
router.post("/cash-increase", catchError(increaseCash));
router.delete("/", catchError(deletePartner));

export default router;
