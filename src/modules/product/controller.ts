import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import { productService } from "./service"; 
import { AuthRequest } from "@/middlewares/auth"; 

// 1. GET ALL
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.getAll(req.query);
  res.status(200).json(new ApiResponse(200, result, "Mahsulotlar yuklandi"));
});

// 2. CREATE (User ID yuboriladi - Tarix uchun)
export const createProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await productService.create(req.body, req.user?.id);
  res.status(201).json(new ApiResponse(201, result, "Mahsulot yaratildi"));
});

// 3. UPDATE
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.update(Number(req.params.id), req.body);
  res.status(200).json(new ApiResponse(200, result, "Mahsulot yangilandi"));
});

// 4. SOFT DELETE
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.delete(Number(req.params.id));
  res.status(200).json(new ApiResponse(200, null, "Mahsulot o'chirildi"));
});

// 5. ADD STOCK (User ID yuboriladi - Tarix uchun)
export const addStock = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { quantity, newPrice } = req.body;
  const result = await productService.addStock(
    Number(req.params.id), 
    Number(quantity), 
    newPrice ? Number(newPrice) : undefined,
    req.user?.id 
  );
  res.status(200).json(new ApiResponse(200, result, "Mahsulot kirim qilindi"));
});

// 6. CHEGIRMA BELGILASH
export const setDiscount = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.setDiscount(Number(req.params.id), req.body);
  res.status(200).json(new ApiResponse(200, result, "Chegirma belgilandi"));
});

// 7. CHEGIRMANI OLIB TASHLASH
export const removeDiscount = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.removeDiscount(Number(req.params.id));
  res.status(200).json(new ApiResponse(200, result, "Chegirma olib tashlandi"));
});