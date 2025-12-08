import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string({ message: "Mahsulot nomi kiritilishi shart" }), 
    
    categoryId: z.number().optional(),
    
    // String yoki Number kelishi mumkin, keyin uni serverda to'g'irlaymiz
    price: z.union([z.string(), z.number()]), 
    
    stock: z.union([z.string(), z.number()]).default(0),
    
    unit: z.string().default("dona"),
    barcode: z.string().optional(),
    currency: z.enum(["UZS", "USD"]).default("UZS"),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>["body"];