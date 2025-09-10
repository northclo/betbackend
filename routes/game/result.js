import express from 'express';
import { catchError } from '../../middleware/error.js';

import { endGame, startGame } from '../../controllers/game/result.js';

const router = express.Router();

router.post('/start/game', catchError(startGame));
router.post('/end/game', catchError(endGame));



export default router;