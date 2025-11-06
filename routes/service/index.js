import express from "express";
const router = express.Router();
import requestIp from "request-ip";
import gameResultRoute from "./result.js";

const allowedIPs = process.env.ALLOWED_IPS
  ? process.env.ALLOWED_IPS.split(",").map(ip => ip.trim())
  : [];

const ipAllowlist = (req, res, next) => {
  const clientIp = requestIp.getClientIp(req); // works behind proxies
  
  console.log("clientIP---->", clientIp);

  if (allowedIPs.includes(clientIp)) {
    return next();
  }

  console.warn(`Blocked request from IP: ${clientIp}`);
  return res.status(403).json({ message: "Access denied: unauthorized IP" });
};

router.use("/", ipAllowlist, gameResultRoute);

export default router;