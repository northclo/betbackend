import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getPartner, getPartnerList, getPartnerById, deletePartner, increaseCash, updatePartner } from "../../controllers/admin/partner/partner.js";
import { registerUser, checkUserAvailability } from "../../controllers/admin/partner/user.js";
import { registerPartner, checkPartnerAvailability } from "../../controllers/admin/partner/register-partner.js";
import { sendMessage } from "../../controllers/admin/partner/message.js";

router.get("/", catchError(getPartner));
router.get('/list', catchError(getPartnerList));
router.get('/by-id', catchError(getPartnerById));
router.post('/register-user', catchError(registerUser));
router.post('/register-user/check', catchError(checkUserAvailability));
router.post('/register-partner', catchError(registerPartner));
router.post('/register-partner/check', catchError(checkPartnerAvailability));
router.post("/message", catchError(sendMessage));
router.post("/cash-increase", catchError(increaseCash));
router.put("/", catchError(updatePartner));
router.delete("/", catchError(deletePartner));

export default router;
