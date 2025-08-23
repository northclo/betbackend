import express from 'express';
import {
    getResultsByDate,
    getLatestResults,
    getResultsbyIndex
}
 from '../controllers/gameResultController.js';
import { catchError } from '../middleware/error.js';

const router = express.Router();

router.get('/', catchError(getResultsByDate));
router.get('/latest', catchError(getLatestResults));
router.get('/byindex', catchError(getResultsbyIndex));

export default router;