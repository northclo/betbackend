import express from 'express';
import  gameresultRoute from './gameResultRoutes.js';

const router = express.Router();
// App api
router.use('/game-result', gameresultRoute);

export default router