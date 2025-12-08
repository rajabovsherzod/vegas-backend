import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, desc, ilike, or, SQL } from "drizzle-orm";
import ApiError from "@/utils/ApiError";
// Importni to'g'riladik, endi u validation.ts faylidan keladi!
import { CreateCategoryInput, UpdateCategoryInput } from "./validation";

// Category uchun Service mantiqi
export const categoryService = {
  // 1. GET ALL
  getAll: async (query: any) => {
    const { search } = query;

    const conditions: SQL[] = [];

    // Faqat active va deleted bo'lmagan kategoriyalarni ko'rsatish
    conditions.push(eq(categories.isActive, true));
    conditions.push(eq(categories.isDeleted, false));

    if (search) {
      conditions.push(ilike(categories.name, `%${search}%`));
    }

    const data = await db.query.categories.findMany({
      where: (table, { and }) => and(...conditions),
      orderBy: desc(categories.id),
    });

    return data;
  },

  // 2. CREATE (Yaratish)
  create: async (payload: CreateCategoryInput) => {
    // ... (Logika)
    const existing = await db.query.categories.findFirst({
      where: eq(categories.name, payload.name),
    });
    if (existing) throw new ApiError(409, "Bu nomdagi kategoriya allaqachon mavjud");

    const [newCategory] = await db.insert(categories).values(payload).returning();
    return newCategory;
  },

  // 3. UPDATE (Yangilash)
  update: async (id: number, payload: UpdateCategoryInput) => {
    // ... (Logika)
    if (payload.name) {
      const existing = await db.query.categories.findFirst({
        where: eq(categories.name, payload.name),
      });
      if (existing && existing.id !== id) {
        throw new ApiError(409, "Bu nom boshqa kategoriyada band qilingan");
      }
    }

    const updatedCategory = await db
      .update(categories)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    if (!updatedCategory.length) throw new ApiError(404, "Kategoriya topilmadi");
    return updatedCategory[0];
  },

  getById: async (id: number) => {
    const data = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });
    if (!data) {
      throw new ApiError(404, "Kategoriya topilmadi");
    }
    return data;
  },

  // 4. DELETE (Soft Delete)
  delete: async (id: number) => {
    const [deleted] = await db
      .update(categories)
      .set({
        isDeleted: true,
        updatedAt: new Date()
      })
      .where(eq(categories.id, id))
      .returning();

    if (!deleted) {
      throw new ApiError(404, "Kategoriya topilmadi");
    }

    return deleted;
  },
};