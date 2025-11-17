import express from "express";
const router = express.Router();

import { checkAuth } from "../../middleware/auth.js";
import { catchError } from "../../middleware/error.js";
import { submitContact } from "../../controllers/customer/support/contact.js";
import { getQuestionsList } from "../../controllers/customer/support/questions-list.js";
import { deleteQuestion } from "../../controllers/customer/support/questions-delete.js";
import { bulkDeleteQuestions } from "../../controllers/customer/support/questions-bulk-delete.js";
import { updateQuestion } from "../../controllers/customer/support/questions-update.js";

router.post("/contact", checkAuth, catchError(submitContact));
router.get("/questions", checkAuth, catchError(getQuestionsList));
router.post("/questions/bulk-delete", checkAuth, catchError(bulkDeleteQuestions));
router.put("/questions/:questionId", checkAuth, catchError(updateQuestion));
router.delete("/questions/:questionId", checkAuth, catchError(deleteQuestion));

export default router;
