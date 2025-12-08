import { Router } from "express";
import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";

const router = Router();

// In-memory storage (test uchun)
let scanResults: any[] = [];

// Scan qilish (telefon)
router.post("/scan", asyncHandler(async (req: Request, res: Response) => {
  const { token, deviceInfo, browser } = req.body;

  const result = {
    id: Date.now().toString(),
    token,
    deviceInfo,
    browser,
    timestamp: new Date().toISOString(),
  };

  scanResults.unshift(result); // Boshiga qo'shish

  // Faqat oxirgi 50 ta scan ni saqlash
  if (scanResults.length > 50) {
    scanResults = scanResults.slice(0, 50);
  }

  res.status(200).json(new ApiResponse(200, result, "Scan saqlandi"));
}));

// Barcha scanlarni olish (admin)
router.get("/scans", asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, scanResults, "Scanlar ro'yxati"));
}));

// Tozalash
router.delete("/scans", asyncHandler(async (req: Request, res: Response) => {
  scanResults = [];
  res.status(200).json(new ApiResponse(200, null, "Tozalandi"));
}));

export default router;
