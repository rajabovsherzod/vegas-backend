import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import logger from "./utils/logger";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Yoki ["http://localhost:3000"] - xavfsizlik uchun
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    logger.info(`🔌 Yangi ulanish (Socket): ${socket.id}`);

    // Adminlar kirganda "admin_room"ga qo'shamiz
    socket.on("join_admin", () => {
      socket.join("admin_room");
      logger.info(`Socket ${socket.id} admin xonasiga qo'shildi`);
    });

    // QR Scan event (Test rejimi)
    socket.on("qr-scan", (data) => {
      logger.info(`📱 QR Scan qilindi: ${data.qrData}`);
      // Barcha ulangan clientlarga broadcast qilish
      io.emit("qr-scan-broadcast", data);
    });

    socket.on("disconnect", () => {
      // logger.info(`❌ Ulanish uzildi: ${socket.id}`);
    });
  });

  return io;
};

// Service ichida ishlatish uchun funksiya
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io hali ishga tushmagan!");
  }
  return io;
};