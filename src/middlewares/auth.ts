import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import ApiError from "@/utils/ApiError";
import asyncHandler from "@/utils/asyncHandler";

// 1. Typescript uchun Requestga user qo'shamiz
export interface AuthRequest extends Request {
  user?: any;
}

// 2. PROTECT (Asosiy himoya)
export const protect = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  // Headerda "Authorization: Bearer <token>" borligini tekshirish
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ApiError(401, "Siz tizimga kirmagansiz (Token yo'q)"));
  }

  try {
    // A) Tokenni tekshirish
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    // B) "Smart Check" - Bazadan userni qayta tekshiramiz
    // Agar xodim ishdan bo'shatilgan bo'lsa (isDeleted) yoki bloklangan bo'lsa (isActive=false)
    // tokeni bo'lsa ham kira olmaydi.
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, decoded.id),
      columns: { password: false } // Parolni olmaymiz
    });

    if (!currentUser) {
      return next(new ApiError(401, "Token egasi bazadan topilmadi"));
    }

    if (currentUser.isDeleted || !currentUser.isActive) {
      return next(new ApiError(403, "Sizning akkauntingiz faol emas yoki o'chirilgan."));
    }

    // C) Userni so'rovga biriktiramiz
    req.user = currentUser;
    next();
    
  } catch (error) {
    return next(new ApiError(401, "Token noto'g'ri yoki muddati tugagan"));
  }
});

// 3. AUTHORIZE (Rolga qarab ruxsat berish)
// Masalan: authorize('owner', 'admin') -> Faqat shu rollar kira oladi
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Foydalanuvchi aniqlanmadi"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Sizning rolingiz (${req.user.role}) bu amalni bajarishga ruxsat bermaydi`));
    }
    
    next();
  };
};