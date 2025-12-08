import { z } from "zod";

// Zod schema
export const createCategorySchema = z.object({
  body: z.object({
    // Xato bergan qator: `z.string({ required_error: "..." })` ni o'zgartirdik.
    // Endi faqat string funktsiyasini ishlatamiz. Zod ob'ekt ichidagi maydonlar avtomatik Required.
    name: z.string() 
           .min(3, "Nom kamida 3 harfdan iborat bo'lishi kerak")
           .max(255, "Nom juda uzun"),
           
    description: z.string().optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(3).max(255).optional(),
    description: z.string().optional(),
  }),
});

// Service qatlami uchun TypeScript tiplarini schemadan chiqarib olamiz.
export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>["body"];