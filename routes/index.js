import express from "express";
const router = express.Router();

import serviceRoute from './service/index.js';

// game Request
router.use('/', serviceRoute);

export default router;
