import { z } from "zod";

// 1. CREATE ORDER SCHEMA
export const createOrderSchema = z.object({
  body: z.object({
    customerName: z.string().optional(),
    type: z.enum(["retail", "wholesale"]).default("retail"),
    paymentMethod: z.enum(["cash", "card", "transfer", "debt"]).default("cash"),
    exchangeRate: z.string().or(z.number()).optional(),
    
    // Umumiy Chegirma
    discountAmount: z.number().optional(),
    discountValue: z.number().optional(),
    discountType: z.enum(["percent", "fixed"]).optional(),

    items: z.array(
      z.object({
        // Bu yerda ham oddiy .number() ishlatamiz
        productId: z.number(), 
        quantity: z.string().or(z.number()),
        
        // Item Chegirmasi
        price: z.number().optional(),
        manualDiscountValue: z.number().optional(),
        manualDiscountType: z.enum(["percent", "fixed"]).optional(),
      })
    ).min(1, "Kamida bitta mahsulot bo'lishi kerak"),
    
    partnerId: z.number().optional(),
  }),
});

// 2. UPDATE ORDER SCHEMA
export const updateOrderSchema = z.object({
  body: z.object({
    customerName: z.string().optional(),
    type: z.enum(["retail", "wholesale"]).optional(),
    paymentMethod: z.enum(["cash", "card", "transfer", "debt"]).optional(),
    exchangeRate: z.string().or(z.number()).optional(),
    
    discountAmount: z.number().optional(),
    discountValue: z.number().optional(),
    discountType: z.enum(["percent", "fixed"]).optional(),

    items: z.array(
      z.object({
        productId: z.number(),
        quantity: z.string().or(z.number()),
        
        price: z.number().optional(),
        manualDiscountValue: z.number().optional(),
        manualDiscountType: z.enum(["percent", "fixed"]).optional(),
      })
    ).min(1),
  }),
});

// 3. UPDATE STATUS SCHEMA
export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      "draft", 
      "completed", 
      "cancelled", 
      "fully_refunded", 
      "partially_refunded"
    ]),
  }),
});

// 🔥 4. REFUND ORDER SCHEMA (TUZATILDI)
export const refundOrderSchema = z.object({
  body: z.object({
    reason: z.string().optional(),

    items: z.array(
      z.object({
        // 🔥 FIX 1: Ichidagi { required_error: ... } olib tashlandi. 
        // Zodda shundoq ham bu maydon majburiy.
        productId: z.number(),
        
        // 🔥 FIX 2: Murakkab pipe o'rniga "z.coerce.number()"
        // Bu string kelsa ham, number kelsa ham raqamga aylantiradi.
        quantity: z.coerce.number().min(0.01, "Miqdor noto'g'ri"),
      })
    ).min(1, "Qaytarish uchun kamida bitta mahsulot tanlanishi kerak"),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>["body"];
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>["body"];
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>["body"];
export type RefundOrderInput = z.infer<typeof refundOrderSchema>["body"];