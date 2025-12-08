import { db } from "@/db";
import { orders, products, users, orderItems } from "@/db/schema";
import { and, eq, gte, sql, desc } from "drizzle-orm";

export const statsService = {
  // Owner uchun biznes analytics
  async getOwnerStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Oxirgi 30 kun uchun
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    // Oxirgi 7 kun uchun
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);

    // 1. Bugungi savdo
    const [todaySales] = await db
      .select({
        totalAmount: sql<string>`sum(${orders.finalAmount})`,
        count: sql<number>`count(*)`
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, today)
        )
      );

    // 2. Haftalik savdo
    const [weeklySales] = await db
      .select({
        totalAmount: sql<string>`sum(${orders.finalAmount})`,
        count: sql<number>`count(*)`
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, last7Days)
        )
      );

    // 3. Oylik savdo
    const [monthlySales] = await db
      .select({
        totalAmount: sql<string>`sum(${orders.finalAmount})`,
        count: sql<number>`count(*)`
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, last30Days)
        )
      );

    // 4. Jami yakunlangan buyurtmalar
    const [totalCompleted] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.status, 'completed'));

    // 5. Ombor qiymati (barcha mahsulotlar narxi * stock)
    const [inventoryValue] = await db
      .select({
        totalValue: sql<string>`sum(${products.price} * ${products.stock})`
      })
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          eq(products.isDeleted, false)
        )
      );

    // 6. Xodimlar soni
    const [staffCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          sql`${users.role} IN ('admin', 'seller')`
        )
      );

    // 7. Oxirgi 7 kunlik savdo grafigi uchun
    const dailySalesChart = await db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`,
        amount: sql<string>`sum(${orders.finalAmount})`,
        count: sql<number>`count(*)`
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, last7Days)
        )
      )
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`);

    // 8. Top 5 mahsulotlar (eng ko'p sotilgan)
    const topProductsRaw: any = await db.execute(sql`
      SELECT 
        oi.product_id as "productId",
        p.name as "productName",
        SUM(oi.quantity) as "totalSold",
        SUM(oi.total_price) as "revenue"
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      INNER JOIN products p ON oi.product_id = p.id
      WHERE o.status = 'completed'
      GROUP BY oi.product_id, p.name
      ORDER BY SUM(oi.quantity) DESC
      LIMIT 5
    `);
    
    const topProducts = topProductsRaw;

    // 9. Kategoriya bo'yicha sotuvlar
    const categorySalesRaw: any = await db.execute(sql`
      SELECT 
        c.id as "categoryId",
        c.name as "categoryName",
        COUNT(DISTINCT o.id) as "orderCount",
        SUM(oi.quantity) as "totalQuantity",
        SUM(oi.total_price) as "totalRevenue"
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      INNER JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.status = 'completed'
      GROUP BY c.id, c.name
      ORDER BY SUM(oi.total_price) DESC
    `);
    
    const categorySales = categorySalesRaw;

    // 10. Top sotuvchilar (eng ko'p sotgan)
    const topSellersRaw: any = await db.execute(sql`
      SELECT 
        u.id as "sellerId",
        u.full_name as "sellerName",
        COUNT(o.id) as "orderCount",
        SUM(o.final_amount) as "totalRevenue"
      FROM orders o
      INNER JOIN users u ON o.seller_id = u.id
      WHERE o.status = 'completed'
      GROUP BY u.id, u.full_name
      ORDER BY SUM(o.final_amount) DESC
      LIMIT 5
    `);
    
    const topSellers = topSellersRaw;

    return {
      todaySales: {
        amount: Number(todaySales?.totalAmount || 0),
        count: Number(todaySales?.count || 0)
      },
      weeklySales: {
        amount: Number(weeklySales?.totalAmount || 0),
        count: Number(weeklySales?.count || 0)
      },
      monthlySales: {
        amount: Number(monthlySales?.totalAmount || 0),
        count: Number(monthlySales?.count || 0)
      },
      totalOrders: Number(totalCompleted?.count || 0),
      inventoryValue: Number(inventoryValue?.totalValue || 0),
      staffCount: Number(staffCount?.count || 0),
      dailySalesChart,
      topProducts,
      categorySales,
      topSellers
    };
  },

  // Admin uchun dashboard stats
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Bugungi savdo (Completed)
    const [salesResult] = await db
      .select({
        totalAmount: sql<string>`sum(${orders.finalAmount})`,
        count: sql<number>`count(*)`
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, today)
        )
      );

    // 2. Kutilayotgan (Draft/Pending)
    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.status, 'draft'));

    // 3. Tugallangan (Jami)
    const [completedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.status, 'completed'));

    // 4. Kam qolgan tovar (Low Stock)
    const [lowStockResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(
        and(
            eq(products.isActive, true),
            eq(products.isDeleted, false),
            sql`${products.stock} <= 10` 
        )
      );

    // 5. So'nggi buyurtmalar
    const recentOrders = await db.query.orders.findMany({
        limit: 6,
        orderBy: [desc(orders.createdAt)],
        with: {
            seller: true,
        }
    });

    // 6. Kategoriya bo'yicha sotuvlar (Admin uchun ham)
    const categorySalesRaw: any = await db.execute(sql`
      SELECT 
        c.id as "categoryId",
        c.name as "categoryName",
        COUNT(DISTINCT o.id) as "orderCount",
        SUM(oi.quantity) as "totalQuantity",
        SUM(oi.total_price) as "totalRevenue"
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      INNER JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.status = 'completed'
      GROUP BY c.id, c.name
      ORDER BY SUM(oi.total_price) DESC
    `);
    
    const categorySales = categorySalesRaw;

    return {
      todaySales: {
        amount: Number(salesResult?.totalAmount || 0),
        count: Number(salesResult?.count || 0)
      },
      pendingOrders: Number(pendingResult?.count || 0),
      completedOrders: Number(completedResult?.count || 0),
      lowStockProducts: Number(lowStockResult?.count || 0),
      recentOrders,
      categorySales
    };
  }
};