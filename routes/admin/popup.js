import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import {
  listPopups,
} from "../../controllers/admin/popup/popup-list.js";
import {
  createPopup,
} from "../../controllers/admin/popup/popup-create.js";
import {
  updatePopup,
} from "../../controllers/admin/popup/popup-update.js";
import {
  deletePopup,
} from "../../controllers/admin/popup/popup-delete.js";
import {
  viewPopup,
} from "../../controllers/admin/popup/popup-view.js";
import upload from "../../middleware/upload.js";

router.get("/list", catchError(listPopups));
router.get("/:popupId", catchError(viewPopup));
router.post("/", upload.single("image"), catchError(createPopup));
router.put("/:popupId", upload.single("image"), catchError(updatePopup));
router.delete("/:popupId", catchError(deletePopup));

export default router;

