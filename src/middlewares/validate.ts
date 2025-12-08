import { Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod";
import ApiError from "../utils/ApiError";

export const validate =
  (schema: ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      // Agar xatolik ZodError bo'lsa
      if (error instanceof ZodError) {
        // 🔥 FIX: (error as any) qilib, TypeScript tekshiruvini aylanib o'tamiz.
        // Chunki runtime paytida 'errors' massivi aniq bo'ladi.
        const errorMessage = (error as any).errors
          .map((issue: any) => issue.message)
          .join(", ");

        return next(new ApiError(400, errorMessage));
      }
      
      // Boshqa xatoliklar
      return next(error);
    }
  };