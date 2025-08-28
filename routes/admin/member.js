import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { createMemberList, deleteMemberList, getMemberList, updateMemberList } from "../../controllers/admin/member/member-list.js";

router.get("/list", catchError(getMemberList));
router.post('/list', catchError(updateMemberList))
router.put('/list', catchError(createMemberList))
router.delete('/list/:id', catchError(deleteMemberList));

export default router;
