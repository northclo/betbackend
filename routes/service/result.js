import express from 'express';
import { catchError } from '../../middleware/error.js';
import { endGame, startGame } from '../../controllers/service/result.js';

const router = express.Router();

router.post('/start', catchError(startGame));
router.post('/end', catchError(endGame));

export default router;