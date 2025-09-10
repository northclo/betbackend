import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import apiRouter from "./routes/api.js";
import appRouter from "./routes/index.js";

dotenv.config();

const app = express();
await connectDB();

// Define Origin CORS config
const originCorsConfig= {
  origin: true,
  credentials: true
};

// Parse env into array
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
  : [];

  console.log("allowedOrigins-->", allowedOrigins.length);
// Define Secure CORS config
const secureCorsConfig = {
  origin: function (origin, callback) {
    if (allowedOrigins.length === 0) {
      callback(null, true);
      return;
    }
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(express.json()); // body parser

app.use('/api', cors(secureCorsConfig), apiRouter);

app.use('/', cors(originCorsConfig), appRouter);

// Example route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));