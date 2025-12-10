import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3),
    barcode: z.string().optional(),
    // 🔥 FIX: String yoki Number kelsa ham qabul qiladi
    price: z.string().or(z.number()), 
    stock: z.string().or(z.number()).optional(),
    unit: z.string().default("dona"),
    currency: z.enum(["UZS", "USD"]).default("UZS"),
    categoryId: z.number().optional(),
    
    // 🔥 BU IKKALASI YETISHMAYOTGAN EDI:
    originalPrice: z.string().or(z.number()).optional(),
    discountPrice: z.string().or(z.number()).optional(),
    
    image: z.string().optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    barcode: z.string().optional(),
    price: z.string().or(z.number()).optional(),
    // stock update orqali o'zgarmaydi (faqat addStock)
    unit: z.string().optional(),
    currency: z.enum(["UZS", "USD"]).optional(),
    categoryId: z.number().optional(),
    
    // 🔥 UPDATE GA HAM QO'SHAMIZ
    originalPrice: z.string().or(z.number()).optional(),
    discountPrice: z.string().or(z.number()).optional(),
    
    image: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const addStockSchema = z.object({
  body: z.object({
    quantity: z.string().or(z.number()),
    newPrice: z.string().or(z.number()).optional(),
  }),
});

export const setDiscountSchema = z.object({
  body: z.object({
    percent: z.number().optional(),
    fixedPrice: z.number().optional(),
    startDate: z.string().optional(),
    endDate: z.string().refine((date) => new Date(date).toString() !== 'Invalid Date', {
        message: "Tugash sanasi noto'g'ri",
    }),
  }).refine((data) => data.percent || data.fixedPrice, {
      message: "Foiz yoki Aniq narx kiritilishi shart",
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>["body"];
export type UpdateProductInput = z.infer<typeof updateProductSchema>["body"];
export type SetDiscountInput = z.infer<typeof setDiscountSchema>["body"];