import { Request, Response } from "express";
import { stockHistoryService } from "./service";
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";

// GET ALL (Filter va Pagination bilan)
export const getStockHistory = asyncHandler(async (req: Request, res: Response) => {
  // Query parametrlarni olamiz
  const { page, limit, startDate, endDate } = req.query;

  const result = await stockHistoryService.getAll({
    page: page ? String(page) : undefined,
    limit: limit ? String(limit) : undefined,
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
  });

  // 🔥 MUHIM: Javob qaytarish shart!
  res.status(200).json(new ApiResponse(200, result, "Kirimlar tarixi"));
});