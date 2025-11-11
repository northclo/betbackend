import dotenv from "dotenv";

dotenv.config();

export const config = {
  JWT_SECRET_KEY: process.env.JWT_SECRET || "jwt_secret_of_running_ball",
  CLIENT_URL:
    process.env.MODE_ENV == "development"
      ? process.env.CLIENT_URL_DEV || "http://localhost:8080/"
      : process.env.CLIENT_URL_PROD || "http://localhost:8080/",
  GMAIL_USER: process.env.GMAIL_USER,
  GMAIL_PASS: process.env.GMAIL_PASS,
  HOTMAIL_USER: process.env.HOTMAIL_USER,
  HOTMAIL_PASS: process.env.HOTMAIL_PASS,
  AUTH_KEY: process.env.AUTH_KEY,
  ALLOW_IP: process.env.ALLOW_IP,
  ALLOW_GAME_IP: process.env.ALLOW_GAME_IP,
  TIME_ZONE: process.env.TIME_ZONE || "Asia/Tokyo"
};
