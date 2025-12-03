import express from "express";
const router = express.Router();
import requestIp from "request-ip";
import gameResultRoute from "./result.js";

const allowedGameIPs = process.env.ALLOWED_GAME_IPS
  ? process.env.ALLOWED_GAME_IPS.split(",").map(ip => ip.trim())
  : [];

const ipAllowlist = (req, res, next) => {
  const clientIp = requestIp.getClientIp(req); // works behind proxies
  const endpoint = req.originalUrl; // requested API endpoint
  
  if (allowedGameIPs.includes(clientIp)) {
    console.log(`✔ Allowed IP: ${clientIp} for endpoint ${endpoint}`);
    return next();
  }

  console.warn(`✖ Blocked IP: ${clientIp} attempting to access ${endpoint}`);
  return res.status(403).json({ message: "Access denied: unauthorized IP" });
};

router.use("/game", ipAllowlist, gameResultRoute);

export default router;