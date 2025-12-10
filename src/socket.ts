import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import logger from "./utils/logger";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    logger.info(`🔌 Yangi ulanish (Socket): ${socket.id}`);

    // 🔥 O'ZGARTIRILDI: Admin emas, "Kassirlar xonasi" (cashier_room)
    // Bu xonaga Cashier ham, Admin ham, Owner ham ulanadi.
    socket.on("join_cashier", () => {
      socket.join("cashier_room");
      logger.info(`Socket ${socket.id} kassirlar xonasi (cashier_room)ga qo'shildi`);
    });

    // Sellerlar uchun alohida xona (Kelajakda kerak bo'lishi mumkin)
    socket.on("join_seller", () => {
      socket.join("seller_room");
      logger.info(`Socket ${socket.id} seller xonasiga qo'shildi`);
    });

    // QR Scan event (Test rejimi)
    socket.on("qr-scan", (data) => {
      logger.info(`📱 QR Scan qilindi: ${data.qrData}`);
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