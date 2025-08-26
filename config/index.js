import dotenv from "dotenv";

dotenv.config();

export const config = {
  JWT_SECRET_KEY: process.env.JWT_SECRET,
};
