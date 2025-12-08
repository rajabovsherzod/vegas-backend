import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import { stockHistoryService } from "./service";


export const getStockHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await stockHistoryService.getAll(req.query);
  res.status(200).json(new ApiResponse(200, result, "Kirimlar tarixi"));
});







