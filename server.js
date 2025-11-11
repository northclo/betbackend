import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import connectDB from "./config/db.js";
import apiRouter from "./routes/api.js";
import appRouter from "./routes/index.js";
import { Server } from "socket.io";
import { onlineUser } from "./controllers/admin/member/online-user.js";

dotenv.config();

const app = express();

// Parse env into array
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

const corsConfig = {
  origin: function (origin, callback) {
    // If no origin (e.g. curl or same-origin request)
    if (!origin) return callback(null, true);

    const isDev = process.env.NODE_ENV === "development";
    // In development → allow HTTP (for localhost)
    if (isDev && origin.startsWith("http://")) {
      return callback(null, true);
    }

    // In production → allow HTTPS only
    if (!isDev && origin.startsWith("https://")) {
      return callback(null, true);
    }

    // Otherwise, block
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

// Parse JSON
app.use(express.json());

// 🔹 Apply CORS globally (before session)
app.use(cors(corsConfig));

// 🔹 Sessions (must come after CORS, before routes)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "my-secret-key", // use env in production
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 5 * 60 * 1000, // 5 minutes
      secure: process.env.NODE_ENV === "production", // true if HTTPS
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// Routes
app.use("/api", apiRouter);
app.use("/", appRouter);
app.get("/", (req, res) => res.send("API is running..."));

// Create HTTP server for socket.io
const server = http.createServer(app);

// Connect DB
await connectDB();

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : "*",
    credentials: true,
  },
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
    } catch (err) { }
  });

  // When a user goes offline
  socket.on("user_offline", async (userToken) => {
    try {
      const userId = await onlineUser(userToken, false);
      onlineUsers.delete(userId);
    } catch (err) { }
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
