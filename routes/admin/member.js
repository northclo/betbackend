import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { createMemberList, deleteMemberList, getMemberList, updateMemberList, getMemberById, sendNotesToUsers } from "../../controllers/admin/member/member-list.js";
import { getMemberLoginInformation } from "../../controllers/admin/member/login-information.js";
import { bulkDeleteLoginInformation } from "../../controllers/admin/member/login-information-bulk-delete.js";
import { blockIp, getBlockedIps, removeBlockedIp } from "../../controllers/admin/member/block-ip.js";
import { getCurrentLoginUser } from "../../controllers/admin/member/current-login-user.js";
import { logoutUser } from "../../controllers/admin/member/logout-user.js";

router.get("/list", catchError(getMemberList));
router.get("/by-id", catchError(getMemberById));
router.post('/list', catchError(updateMemberList))
router.put('/list', catchError(createMemberList))
router.delete('/list/:id', catchError(deleteMemberList));
router.get('/login', catchError(getMemberLoginInformation));
router.post('/login/bulk-delete', catchError(bulkDeleteLoginInformation));
router.put('/block-ip', catchError(blockIp));
router.get('/block-ip', catchError(getBlockedIps));
router.delete('/block-ip/:id', catchError(removeBlockedIp));
router.get('/current-login', catchError(getCurrentLoginUser));
router.post('/logout', catchError(logoutUser));
router.post('/send-notes', catchError(sendNotesToUsers));

export default router;
