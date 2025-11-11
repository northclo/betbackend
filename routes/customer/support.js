import express from "express";
import { submitContactMessage } from "../../controllers/customer/support/contact.js";

const router = express.Router();

router.post("/contact", submitContactMessage);

export default router;
