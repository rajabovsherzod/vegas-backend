import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { createServer } from "http";
import { initSocket } from "./socket";

import logger from "./utils/logger";
import errorHandler from "./middlewares/errorHandler";
import ApiError from "./utils/ApiError";
import { globalLimiter, rateLimitInfo } from "./middlewares/rateLimiter";
import { initGlitchTip, glitchtipRequestHandler, glitchtipErrorHandler } from "./config/glitchtip";

// Routerlarni import qilish
import routes from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- 0. MONITORING (GLITCHTIP) ---
initGlitchTip();
app.use(glitchtipRequestHandler);

// --- 1. XAVFSIZLIK (MIDDLEWARES) ---

app.use(helmet());

// CORS configuration
const whitelist = ["http://localhost:3000", "https://vegas-xorazm.uz"];
app.use(
  cors({
    origin: "*", // Socket uchun vaqtincha "*" (production da whitelistga o'tkazish)
    credentials: true,
  })
);

// Rate limiting - Advanced
app.use("/api", globalLimiter);
app.use(rateLimitInfo);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// --- 2. ROUTELAR ---

app.get("/", (req, res) => {
  res.send("Vegas CRM API is running 🚀");
});

app.use("/api/v1", routes);

// --- 3. 404 HANDLER ---
app.use((req, res, next) => {
  next(new ApiError(404, `Bunday manzil topilmadi: ${req.originalUrl}`));
});

// --- 4. GLOBAL ERROR HANDLER ---
app.use(glitchtipErrorHandler);
app.use(errorHandler);

// --- 5. SERVER START (INTEGRATSIYA) ---

// Expressni HTTP serverga o'raymiz
const httpServer = createServer(app);

// Socketni ishga tushiramiz
initSocket(httpServer);

// app.listen EMAS, httpServer.listen!
// 0.0.0.0 - barcha tarmoq interfeyslarida eshitish (LAN orqali kirish uchun)
const server = httpServer.listen(PORT as number, '0.0.0.0', () => {
  logger.info(`🚀 Server (HTTP + Socket) ${PORT}-portda ishga tushdi (Mode: ${process.env.NODE_ENV})`);
  logger.info(`📱 LAN orqali kirish: http://<IP>:${PORT}`);
});

// Unhandled Rejection
process.on("unhandledRejection", (err: any) => {
  logger.error("UNHANDLED REJECTION! 💥 Server o‘chirilmoqda...");
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});