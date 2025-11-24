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
  ALLOWED_IPS: process.env.ALLOWED_IPS || [],
  ALLOW_GAME_IP: process.env.ALLOW_GAME_IP,
  TIME_ZONE: process.env.TIME_ZONE || "Asia/Tokyo",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "AKIA3FXPRCROJRWMWM7J",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "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",
  AWS_REGION: process.env.AWS_REGION || "us-east-2",
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || "superball-race-storage",
};
