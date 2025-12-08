import { db } from "@/db";
import { stockHistory } from "@/db/schema";
import { desc, and, gte, lte, sql } from "drizzle-orm";

export const stockHistoryService = {
  getAll: async (query: any) => {
    const { page = "1", limit = "50", startDate, endDate } = query;
    const limitNum = Number(limit);
    const offsetNum = (Number(page) - 1) * limitNum;

    const conditions = [];
    
    if (startDate) {
        conditions.push(gte(stockHistory.createdAt, new Date(startDate)));
    }
    if (endDate) {
        conditions.push(lte(stockHistory.createdAt, new Date(endDate)));
    }

    // 🔥 FIX: 'admin' EMAS, 'addedBy' ishlatamiz (Schemaga moslab)
    const data = await db.query.stockHistory.findMany({
      where: and(...conditions),
      limit: limitNum,
      offset: offsetNum,
      orderBy: desc(stockHistory.createdAt),
      with: {
        product: true, 
        addedBy: { // <-- User ma'lumotlarini olish
            columns: { fullName: true, username: true, role: true }
        }
      }
    });

    const totalRes = await db.select({ count: sql<number>`count(*)` }).from(stockHistory).where(and(...conditions));
    const total = Number(totalRes[0].count);

    return {
      history: data,
      pagination: {
        page: Number(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      }
    };
  }
};