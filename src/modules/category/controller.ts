import { Request, Response } from "express";
import { categoryService } from "./service"; 
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";

// 1. GET ALL
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const result = await categoryService.getAll(req.query);
  res.status(200).json(new ApiResponse(200, result, "Kategoriyalar yuklandi"));
});

// 2. GET BY ID (Routerda talab qilingan funksiya)
export const getCategoryById = asyncHandler(async (req: Request, res: Response) => {
    // Service.getById() funksiyasi kerak bo'ladi (qo'shimcha funksiya deb hisoblaymiz)
    const result = await categoryService.getById(Number(req.params.id));
    res.status(200).json(new ApiResponse(200, result, "Kategoriya topildi"));
});


// 3. CREATE
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const result = await categoryService.create(req.body);
  res.status(201).json(new ApiResponse(201, result, "Kategoriya yaratildi"));
});

// 4. UPDATE
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const result = await categoryService.update(Number(req.params.id), req.body);
  res.status(200).json(new ApiResponse(200, result, "Kategoriya yangilandi"));
});

// 5. DELETE
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await categoryService.delete(Number(req.params.id));
  res.status(200).json(new ApiResponse(200, null, "Kategoriya o'chirildi"));
});

// 💡 ENDI BARCHA EXPORTLAR ROUTER TALABIGA JAVOB BERADI.