import { db } from "@/db";
import { stockHistory } from "@/db/schema";
import { desc, and, gte, lte, sql, eq } from "drizzle-orm";

export const stockHistoryService = {
  
  // GET ALL (Filter + Pagination)
  getAll: async (query: any) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const offset = (page - 1) * limit;

    const conditions = [];
    
    // 🔥 SANA FILTRINI MUSTAHKAMLASH
    if (query.startDate) {
        // Kunning boshi (00:00:00.000)
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0); 
        conditions.push(gte(stockHistory.createdAt, start));
    }

    if (query.endDate) {
        // Kunning oxiri (23:59:59.999)
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(stockHistory.createdAt, end));
    }

    // So'rovni yuborish
    const data = await db.query.stockHistory.findMany({
      where: and(...conditions),
      limit: limit,
      offset: offset,
      orderBy: [desc(stockHistory.createdAt)],
      with: {
        product: true, 
        addedBy: { 
            columns: { fullName: true, username: true, role: true }
        }
      }
    });

    // Jami sonini hisoblash (Pagination uchun)
    const totalRes = await db.select({ count: sql<number>`count(*)` })
        .from(stockHistory)
        .where(and(...conditions));
        
    const total = Number(totalRes[0]?.count || 0);

    return {
      data: data, // Frontend "data.data" deb kutyapti
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }
};