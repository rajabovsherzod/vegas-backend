import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, desc, ilike, or, and, sql, SQL } from "drizzle-orm";
import ApiError from "@/utils/ApiError";
import logger from "@/utils/logger";
import { getIO } from "@/socket";
import { CreateCategoryInput, UpdateCategoryInput } from "./validation";

interface GetAllCategoriesQuery {
  search?: string;
  limit?: string;
  page?: string;
}

export const categoryService = {
  // 1. GET ALL
  getAll: async (query: GetAllCategoriesQuery = {}) => {
    const { search, limit = "20", page = "1" } = query;
    const limitNum = Number(limit);
    const pageNum = Number(page);
    const offsetNum = (pageNum - 1) * limitNum;

    const conditions: (SQL | undefined)[] = [
      eq(categories.isActive, true),
      eq(categories.isDeleted, false),
    ];

    if (search) {
      conditions.push(
        or(
          ilike(categories.name, `%${search}%`),
          ilike(categories.description, `%${search}%`)
        )
      );
    }

    const finalConditions = and(...conditions.filter((c): c is SQL => !!c));

    const data = await db.query.categories.findMany({
      where: finalConditions,
      limit: limitNum,
      offset: offsetNum,
      orderBy: desc(categories.createdAt),
    });

    const totalRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(finalConditions);
    const total = Number(totalRes[0].count);

    return {
      categories: data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  },

  // 2. CREATE
  create: async (payload: CreateCategoryInput) => {
    const existing = await db.query.categories.findFirst({
      where: eq(categories.name, payload.name),
    });
    if (existing)
      throw new ApiError(409, "Bu nomdagi kategoriya allaqachon mavjud");

    const [newCategory] = await db
      .insert(categories)
      .values(payload)
      .returning();

    logger.info(`Yangi kategoriya: ${newCategory.name}`);

    try {
      getIO().emit("category_updated", newCategory);
    } catch (e) {
      /* ignore */
    }

    return newCategory;
  },

  // 3. UPDATE
  update: async (id: number, payload: UpdateCategoryInput) => {
    if (payload.name) {
      const existing = await db.query.categories.findFirst({
        where: eq(categories.name, payload.name),
      });
      if (existing && existing.id !== id) {
        throw new ApiError(409, "Bu nom boshqa kategoriyada band qilingan");
      }
    }

    const [updatedCategory] = await db
      .update(categories)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();

    if (!updatedCategory) throw new ApiError(404, "Kategoriya topilmadi");

    try {
      getIO().emit("category_updated", updatedCategory);
    } catch (e) {
      /* ignore */
    }

    return updatedCategory;
  },

  // 4. GET BY ID
  getById: async (id: number) => {
    const data = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });
    if (!data) throw new ApiError(404, "Kategoriya topilmadi");
    return data;
  },

  // 5. DELETE (Soft)
  delete: async (id: number) => {
    const [deleted] = await db
      .update(categories)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();

    if (!deleted) throw new ApiError(404, "Kategoriya topilmadi");

    try {
      getIO().emit("category_updated", { id, deleted: true });
    } catch (e) {
      /* ignore */
    }

    return deleted;
  },
};
