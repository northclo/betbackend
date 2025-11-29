import express from "express";

import requestIp from "request-ip";
import gameResultRoute from "./result.js";

import moment from "moment-timezone";

const router = express.Router();



const allowedGameIPs = process.env.ALLOWED_GAME_IPS
  ? process.env.ALLOWED_GAME_IPS.split(",").map(ip => ip.trim())
  : [];

const ipAllowlist = (req, res, next) => {
  const clientIp = requestIp.getClientIp(req); // works behind proxies
  
  const ChinaTimenow = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');

  if (allowedGameIPs.includes(clientIp)) {
    console.log(`[${ChinaTimenow}] Allowed clientIP ----> ${clientIp}`);
    return next();
  }

  console.warn(`[${ChinaTimenow}] ❌ Blocked request from IP: ${clientIp}`);
  return res.status(403).json({ message: "Access denied: unauthorized IP" });
};

router.use("/game", ipAllowlist, gameResultRoute);

export default router;