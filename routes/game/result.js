import express from 'express';
import { catchError } from '../../middleware/error.js';
import { endGame, startGame } from '../../controllers/game/result.js';
import { getResultsByDate, getLatestResults, getResultsbyIndex } from '../../controllers/game/get-result.js';

const router = express.Router();

router.post('/start/game', catchError(startGame));
router.post('/end/game', catchError(endGame));
router.get('/', catchError(getResultsByDate));
router.get('/latest', catchError(getLatestResults));
router.get('/byindex', catchError(getResultsbyIndex));

export default router;