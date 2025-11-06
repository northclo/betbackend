import dotenv from "dotenv";

dotenv.config();

export const config = {
  JWT_SECRET_KEY: process.env.JWT_SECRET,
  CLIENT_URL:
    process.env.MODE_ENV == "development"
      ? process.env.CLIENT_URL_DEV
      : process.env.CLIENT_URL_PROD,
  GMAIL_USER: process.env.GMAIL_USER,
  GMAIL_PASS: process.env.GMAIL_PASS,
  HOTMAIL_USER: process.env.HOTMAIL_USER,
  HOTMAIL_PASS: process.env.HOTMAIL_PASS,
  AUTH_KEY: process.env.AUTH_KEY,
  ALLOWED_IPS: process.env.ALLOWED_IPS,
  ALLOW_GAME_IP: process.env.ALLOW_GAME_IP,
  TIME_ZONE: process.env.TIME_ZONE
};
