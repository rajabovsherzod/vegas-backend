import { z } from "zod";

// 1. CREATE ORDER SCHEMA
export const createOrderSchema = z.object({
  body: z.object({
    customerName: z.string().optional(),
    type: z.enum(["retail", "wholesale"]).default("retail"),
    paymentMethod: z.enum(["cash", "card", "transfer", "debt"]).default("cash"),
    exchangeRate: z.string().or(z.number()).optional(),
    
    // 🔥 YANGI: Umumiy Chegirma "Retsepti"
    discountAmount: z.number().optional(), // Natija (so'mda)
    discountValue: z.number().optional(),  // Kiritilgan qiymat (10 yoki 50000)
    discountType: z.enum(["percent", "fixed"]).optional(), // Turi

    items: z.array(
      z.object({
        productId: z.number().refine((val) => val > 0, { message: "Mahsulot IDsi majburiy" }),
        quantity: z.string().or(z.number()),
        
        // 🔥 YANGI: Item Chegirmasi "Retsepti"
        price: z.number().optional(), // Sotilgan narx (natija)
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
    
    // 🔥 YANGI
    discountAmount: z.number().optional(),
    discountValue: z.number().optional(),
    discountType: z.enum(["percent", "fixed"]).optional(),

    items: z.array(
      z.object({
        productId: z.number(),
        quantity: z.string().or(z.number()),
        
        // 🔥 YANGI
        price: z.number().optional(),
        manualDiscountValue: z.number().optional(),
        manualDiscountType: z.enum(["percent", "fixed"]).optional(),
      })
    ).min(1),
  }),
});

// ... (Update Status o'zgarishsiz qoladi)
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

export type CreateOrderInput = z.infer<typeof createOrderSchema>["body"];
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>["body"];
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>["body"];