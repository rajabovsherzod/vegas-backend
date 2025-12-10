import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import { productService } from "./service"; 
import { AuthRequest } from "@/middlewares/auth"; 

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.getAll(req.query);
  res.status(200).json(new ApiResponse(200, result, "Mahsulotlar yuklandi"));
});

export const createProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await productService.create(req.user.id, req.body);
  res.status(201).json(new ApiResponse(201, result, "Mahsulot yaratildi"));
});

export const updateProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await productService.update(Number(req.params.id), req.user.id, req.body);
  res.status(200).json(new ApiResponse(200, result, "Mahsulot yangilandi"));
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.delete(Number(req.params.id));
  res.status(200).json(new ApiResponse(200, null, "Mahsulot o'chirildi"));
});

export const addStock = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { quantity, newPrice } = req.body;
  const result = await productService.addStock(
    Number(req.params.id), 
    Number(quantity), 
    newPrice ? Number(newPrice) : undefined,
    req.user.id 
  );
  res.status(200).json(new ApiResponse(200, result, "Kirim qilindi"));
});

export const setDiscount = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.setDiscount(Number(req.params.id), req.body);
  res.status(200).json(new ApiResponse(200, result, "Chegirma belgilandi"));
});

export const removeDiscount = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.removeDiscount(Number(req.params.id));
  res.status(200).json(new ApiResponse(200, result, "Chegirma olib tashlandi"));
});

export const getTrendingProducts = asyncHandler(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 20;
  const result = await productService.getTrending(limit);
  res.status(200).json(new ApiResponse(200, result, "Trend mahsulotlar"));
});

// QUICK SEARCH
export const quickSearchProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = String(req.query.q || "");
  const limit = Number(req.query.limit) || 10;
  const result = await productService.quickSearch(query, limit);
  res.status(200).json(new ApiResponse(200, result, "Qidiruv natijalari"));
});