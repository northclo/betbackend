import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getMemberList } from "../../controllers/admin/member/get-list.js";
import { deleteMemberList } from "../../controllers/admin/member/delete-list.js";
import { createMemberList } from "../../controllers/admin/member/create-list.js";

router.get("/list", catchError(getMemberList));
router.put('/list', catchError(createMemberList))
router.delete('/list/:id', catchError(deleteMemberList));

export default router;
