import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import {
  listSupportTickets,
} from "../../controllers/admin/support/support-list.js";
import {
  viewSupportTicket,
} from "../../controllers/admin/support/support-view.js";
import {
  updateSupportTicket,
} from "../../controllers/admin/support/support-update.js";
import {
  replyToSupportTicket,
} from "../../controllers/admin/support/support-reply.js";
import {
  deleteSupportTicket,
} from "../../controllers/admin/support/support-delete.js";
import {
  bulkDeleteSupportTickets,
} from "../../controllers/admin/support/support-bulk-delete.js";
import {
  getSupportSummary,
} from "../../controllers/admin/support/support-summary.js";

router.get("/list", catchError(listSupportTickets));
router.get("/summary", catchError(getSupportSummary));
router.post("/:ticketId/reply", catchError(replyToSupportTicket));
router.post("/bulk-delete", catchError(bulkDeleteSupportTickets));
router.get("/:ticketId", catchError(viewSupportTicket));
router.put("/:ticketId", catchError(updateSupportTicket));
router.delete("/:ticketId", catchError(deleteSupportTicket));

export default router;

