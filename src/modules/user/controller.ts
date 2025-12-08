import { Request, Response } from "express";
import { userService } from "./service";
import asyncHandler from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.getAll();
  res.status(200).json(new ApiResponse(200, result, "Xodimlar ro'yxati"));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.create(req.body);
  res.status(201).json(new ApiResponse(201, result, "Yangi xodim yaratildi"));
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.getById(Number(req.params.id));
  res.status(200).json(new ApiResponse(200, result, "Xodim ma'lumotlari"));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.update(Number(req.params.id), req.body);
  res.status(200).json(new ApiResponse(200, result, "Ma'lumotlar yangilandi"));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.delete(Number(req.params.id));
  res.status(200).json(new ApiResponse(200, null, "Xodim o'chirildi"));
});