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

router.get("/list", catchError(listPopups));
router.get("/:popupId", catchError(viewPopup));
router.post("/", catchError(createPopup));
router.put("/:popupId", catchError(updatePopup));
router.delete("/:popupId", catchError(deletePopup));

export default router;

