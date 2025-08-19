import express from 'express';
import {
    getResultsByDate,
    getLatestResults
}
 from '../controllers/gameResultController.js';
import { catchError } from '../middleware/error.js';

const router = express.Router();

router.get('/', catchError(getResultsByDate));
router.get('/latest', catchError(getLatestResults));

export default router;