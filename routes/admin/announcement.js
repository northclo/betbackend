import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import {
  listAnnouncements,
} from "../../controllers/admin/announcement/announcement-list.js";
import {
  createAnnouncement,
} from "../../controllers/admin/announcement/announcement-create.js";
import {
  updateAnnouncement,
} from "../../controllers/admin/announcement/announcement-update.js";
import {
  deleteAnnouncement,
} from "../../controllers/admin/announcement/announcement-delete.js";
import upload from "../../middleware/upload.js";

router.get("/list", catchError(listAnnouncements));
router.post("/", upload.single("image"), catchError(createAnnouncement));
router.put("/:announcementId", upload.single("image"), catchError(updateAnnouncement));
router.delete("/:announcementId", catchError(deleteAnnouncement));

export default router;

