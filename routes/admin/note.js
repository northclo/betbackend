import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { listNotes } from "../../controllers/admin/note/note-list.js";
import { viewNote } from "../../controllers/admin/note/note-view.js";
import { updateNote } from "../../controllers/admin/note/note-update.js";
import { deleteNote } from "../../controllers/admin/note/note-delete.js";

router.get("/list", catchError(listNotes));
router.get("/:noteId", catchError(viewNote));
router.put("/:noteId", catchError(updateNote));
router.delete("/:noteId", catchError(deleteNote));

export default router;

