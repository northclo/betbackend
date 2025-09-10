import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { createMemberList, deleteMemberList, getMemberList, updateMemberList } from "../../controllers/admin/member/member-list.js";
import { getMemberLoginInformation } from "../../controllers/admin/member/login-information.js";

router.get("/list", catchError(getMemberList));
router.post('/list', catchError(updateMemberList))
router.put('/list', catchError(createMemberList))
router.delete('/list/:id', catchError(deleteMemberList));
router.get('/login', catchError(getMemberLoginInformation))

export default router;
