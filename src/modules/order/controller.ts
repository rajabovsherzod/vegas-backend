import { Request, Response } from "express";
import { orderService } from "./service";
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import { AuthRequest } from "@/middlewares/auth";

// 1. CREATE
export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const result = await orderService.create(userId, req.body);
  res.status(201).json(new ApiResponse(201, result, "Buyurtma muvaffaqiyatli yaratildi"));
});

// 2. GET ALL
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

// 3. GET BY ID
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  const result = await orderService.getById(orderId);
  res.status(200).json(new ApiResponse(200, result, "Buyurtma ma'lumotlari"));
});

// 4. UPDATE (EDIT)
export const updateOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;

  const result = await orderService.update(orderId, userId, userRole, req.body);
  res.status(200).json(new ApiResponse(200, result, "Buyurtma yangilandi"));
});

// 5. UPDATE STATUS
export const updateOrderStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const adminId = req.user.id;

  const result = await orderService.updateStatus(orderId, adminId, req.body);
  res.status(200).json(new ApiResponse(200, result, `Buyurtma statusi o'zgardi: ${req.body.status}`));
});

// 6. MARK AS PRINTED
export const markAsPrinted = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  const result = await orderService.markAsPrinted(orderId);
  res.status(200).json(new ApiResponse(200, result, "Chek chiqarildi deb belgilandi"));
});