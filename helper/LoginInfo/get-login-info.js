import requestIp from "request-ip";
import geoip from "geoip-lite";

export const getLoginInfo = (req) => {
  const ipAddress = requestIp.getClientIp(req) || req.ip || req.connection?.remoteAddress || "Unknown";
  
  const cleanIp = ipAddress.replace(/^::ffff:/, "");

  const userAgent = req.headers["user-agent"] || "";

  let device = "Unknown";
  let isMobile = false;

  if (userAgent) {
    const mobileRegex = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    isMobile = mobileRegex.test(userAgent);

    if (/Windows NT/i.test(userAgent)) {
      device = "Windows";
    } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
      device = "Mac";
    } else if (/Linux/i.test(userAgent)) {
      device = "Linux";
    } else if (/Android/i.test(userAgent)) {
      device = "Android";
      isMobile = true;
    } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
      device = isMobile ? "iPhone" : "iPad";
      isMobile = true;
    } else if (/Windows Phone/i.test(userAgent)) {
      device = "Windows Phone";
      isMobile = true;
    } else {
      device = "Other";
    }
  }

  let location = "Unknown";
  try {
    const geo = geoip.lookup(cleanIp);
    if (geo) {
      const parts = [];
      if (geo.city) parts.push(geo.city);
      if (geo.country) parts.push(geo.country);
      location = parts.length > 0 ? parts.join(", ") : "Unknown";
    }
  } catch (error) {
    console.error("Error getting location from IP:", error);
    location = "Unknown";
  }

  return {
    ip_address: cleanIp,
    device,
    location,
    mobile: isMobile,
  };
};

