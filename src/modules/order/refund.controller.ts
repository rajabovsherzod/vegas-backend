import { Request, Response } from "express";
import { refundService } from "./refund.service"; // 🔥 Yangi serviceni ulaymiz
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import { AuthRequest } from "@/middlewares/auth";

// 1. REFUND QILISH (POST)
export const refundOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const userId = req.user.id; // Qaytarayotgan shaxs IDsi
  const { items, reason } = req.body;

  const result = await refundService.processRefund(orderId, {
    items,
    reason,
    refundedById: userId
  });

  res.status(200).json(new ApiResponse(200, result, "Buyurtma muvaffaqiyatli qaytarildi"));
});

// 2. TARIXNI OLISH (GET)
export const getAllRefunds = asyncHandler(async (req: Request, res: Response) => {
  const result = await refundService.getAll();
  res.status(200).json(new ApiResponse(200, result, "Qaytarishlar tarixi"));
});