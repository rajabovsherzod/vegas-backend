import { Request, Response } from "express";
import { orderService } from "./service";
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import { AuthRequest } from "@/middlewares/auth";

/**
 * 1. CREATE ORDER
 * Seller, Cashier yoki Owner yangi buyurtma (draft) yaratadi
 */
export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const result = await orderService.create(userId, req.body);
  
  res.status(201).json(new ApiResponse(201, result, "Buyurtma muvaffaqiyatli yaratildi"));
});

/**
 * 2. GET ALL ORDERS
 * Rolga qarab filterlanadi:
 * - Seller: Faqat o'z buyurtmalari
 * - Admin/Cashier: Barcha buyurtmalar
 */
export const getOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, role } = req.user;
  let result;

  if (role === 'seller') {
    result = await orderService.getBySellerId(id);
  } else {
    result = await orderService.getAll();
  }

  res.status(200).json(new ApiResponse(200, result, "Buyurtmalar ro'yxati"));
});

/**
 * 3. GET ORDER BY ID
 * Bitta buyurtma haqida to'liq ma'lumot
 */
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  const result = await orderService.getById(orderId);
  
  res.status(200).json(new ApiResponse(200, result, "Buyurtma ma'lumotlari"));
});

/**
 * 4. UPDATE ORDER (EDIT)
 * Draft holatidagi buyurtmani tahrirlash
 */
export const updateOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;

  // Servisga rolini ham beramiz, u tekshiradi (Seller begona orderni o'zgartira olmasligi uchun)
  const result = await orderService.update(orderId, userId, userRole, req.body);
  
  res.status(200).json(new ApiResponse(200, result, "Buyurtma yangilandi"));
});

/**
 * 5. UPDATE STATUS
 * Faqat Admin/Cashier (Confirm, Cancel, Completed)
 */
export const updateOrderStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const adminId = req.user.id;

  const result = await orderService.updateStatus(orderId, adminId, req.body);
  
  res.status(200).json(new ApiResponse(200, result, `Buyurtma statusi o'zgardi: ${req.body.status}`));
});

/**
 * 6. MARK AS PRINTED
 * Chek chiqarilganda belgilanadi
 */
export const markAsPrinted = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  const result = await orderService.markAsPrinted(orderId);
  
  res.status(200).json(new ApiResponse(200, result, "Chek chiqarildi deb belgilandi"));
});

/**
 * 7. REFUND ORDER (🔥 YANGI)
 * Buyurtmani qisman yoki to'liq qaytarish
 */
export const refundOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const userId = req.user.id; // Qaytarayotgan admin IDsi
  const { items, reason } = req.body;

  const result = await orderService.refund(orderId, {
    items,
    reason,
    refundedById: userId
  });

  res.status(200).json(new ApiResponse(200, result, "Buyurtma muvaffaqiyatli qaytarildi"));
});