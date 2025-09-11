import express from "express";
const router = express.Router();

import { catchError } from "../../middleware/error.js";
import { getGameManagement } from "../../controllers/admin/game/game-management.js";

router.get('/', catchError(getGameManagement))


export default router;
