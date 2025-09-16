import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import connectDB from "./config/db.js";
import apiRouter from "./routes/api.js";
import appRouter from "./routes/index.js";
import { Server } from "socket.io";
import { onlineUser } from './controllers/admin/member/online-user.js';

dotenv.config();

const app = express();

// Define Origin CORS config
const originCorsConfig = {
  origin: true,
  credentials: true
};

// Parse env into array
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
  : [];

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

// Parse JSON
app.use(express.json());

// Routes
app.use('/api', cors(secureCorsConfig), apiRouter);
app.use('/', cors(originCorsConfig), appRouter);
app.get("/", (req, res) => res.send("API is running..."));

// Create HTTP server for socket.io
const server = http.createServer(app);

// Connect DB
await connectDB();

// Socket.IO setup
const io = new Server(server, {
  cors: { origin: allowedOrigins.length ? allowedOrigins : "*", credentials: true },
});

// Attach io to app for access in routes/controllers
app.set("io", io);

// Track online users: user_nickname -> socket.id
const onlineUsers = new Map();

io.on("connection", (socket) => {
  // When a user comes online
  socket.on("user_online", async (userToken) => {
    try {
      const userId = await onlineUser(userToken, true);
      onlineUsers.set(userId, socket.id);
    } catch (err) {
    }
  });

  // When a user goes offline
  socket.on("user_offline", async (userToken) => {
    try {
      const userId = await onlineUser(userToken, false);
      onlineUsers.delete(userId);
    } catch (err) {
    }
  });

  // Remove from onlineUsers on disconnect
  socket.on("disconnect", () => {
    for (const [nickname, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(nickname);
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export { io, onlineUsers };
