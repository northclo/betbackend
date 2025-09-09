import express from 'express';
import { catchError } from '../../middleware/error.js';
import { getResultsByDate, getLatestResults, getResultsbyIndex } from '../../controllers/game/get-result.js';

const router = express.Router();

router.get('/', catchError(getResultsByDate));
router.get('/latest', catchError(getLatestResults));
router.get('/byindex', catchError(getResultsbyIndex));

export default router;