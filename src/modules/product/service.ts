import { db } from "@/db";
import { products, priceHistory, stockHistory } from "@/db/schema";
import { eq, desc, ilike, or, and, sql, SQL } from "drizzle-orm";
import ApiError from "@/utils/ApiError";
import { getIO } from "@/socket";
import { CreateProductInput, UpdateProductInput, SetDiscountInput } from "./validation";

interface GetAllProductsQuery {
  search?: string;
  limit?: string;
  page?: string;
  categoryId?: string;
  showHidden?: string;
}
// 🔥 HELPER: Virtual "price" qo'shadi (frontend uchun backward compatibility)
const addVirtualPrice = (product: any) => {
  if (!product) return product;
  
  // Raw SQL snake_case, ORM camelCase qaytaradi
  const sellingUzs = product.sellingPriceUzs ?? product.selling_price_uzs ?? '0';
  const sellingUsd = product.sellingPriceUsd ?? product.selling_price_usd ?? '0';
  const currency = product.currency ?? 'UZS';
  
  const price = currency === 'USD' ? sellingUsd : sellingUzs;
  
  return {
    ...product,
    price,
    originalPrice: price,
  };
};

export const productService = {
  // 1. GET ALL
  getAll: async (query: GetAllProductsQuery) => {
    const { search, limit = "20", page = "1", categoryId, showHidden } = query;
    const limitNum = Number(limit);
    const pageNum = Number(page);
    const offsetNum = (pageNum - 1) * limitNum;

    const conditions: (SQL | undefined)[] = [
      eq(products.isDeleted, false)
    ];

    if (showHidden !== 'true') {
      conditions.push(eq(products.isActive, true));
    }

    if (search) {
      conditions.push(or(ilike(products.name, `%${search}%`), ilike(products.barcode, `%${search}%`)));
    }
    if (categoryId && categoryId !== "all") {
      conditions.push(eq(products.categoryId, Number(categoryId)));
    }

    const finalConditions = and(...conditions.filter((c): c is SQL => !!c));

    const data = await db.query.products.findMany({
      where: finalConditions,
      limit: limitNum,
      offset: offsetNum,
      orderBy: desc(products.createdAt),
      with: { category: true }
    });

    const totalRes = await db.select({ count: sql<number>`count(*)` }).from(products).where(finalConditions);
    const total = Number(totalRes[0].count);

    return {
      products: data.map(addVirtualPrice), // 🔥 Virtual price qo'shildi
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  },

  // 2. CREATE
  create: async (userId: number, payload: CreateProductInput) => {
    return await db.transaction(async (tx) => {
      if (payload.barcode) {
        const existing = await tx.query.products.findFirst({ where: eq(products.barcode, payload.barcode) });
        if (existing) throw new ApiError(409, "Bu barkod allaqachon mavjud!");
      }

      const currency = payload.currency || 'UZS';
      
      // 🔥 Narxlarni hisoblash (price yoki sellingPrice dan)
      let sellingPriceUzs = '0';
      let sellingPriceUsd = '0';
      
      if (payload.sellingPriceUzs) {
        sellingPriceUzs = String(payload.sellingPriceUzs);
      } else if (payload.price && currency === 'UZS') {
        sellingPriceUzs = String(payload.price);
      }
      
      if (payload.sellingPriceUsd) {
        sellingPriceUsd = String(payload.sellingPriceUsd);
      } else if (payload.price && currency === 'USD') {
        sellingPriceUsd = String(payload.price);
      }

      const [newProduct] = await tx.insert(products).values({
        name: payload.name,
        barcode: payload.barcode || null,
        categoryId: payload.categoryId ? Number(payload.categoryId) : null,
        
        incomingPriceUzs: payload.incomingPriceUzs ? String(payload.incomingPriceUzs) : '0',
        incomingPriceUsd: payload.incomingPriceUsd ? String(payload.incomingPriceUsd) : '0',
        sellingPriceUzs,
        sellingPriceUsd,
        
        stock: String(payload.stock || 0),
        unit: payload.unit || 'dona',
        currency,
        discountPrice: payload.discountPrice ? String(payload.discountPrice) : null,
        image: payload.image || null,
      }).returning();

      if (Number(payload.stock) > 0) {
        await tx.insert(stockHistory).values({
          productId: newProduct.id,
          quantity: String(payload.stock),
          oldStock: "0",
          newStock: String(payload.stock),
          addedBy: userId,
          note: "Boshlang'ich kirim",
        });
      }

      const result = addVirtualPrice(newProduct); // 🔥 Virtual price
      try { getIO().emit("product_created", result); } catch (e) { /* ignore */ }
      return result;
    });
  },

  // 3. UPDATE
  update: async (id: number, userId: number, payload: UpdateProductInput) => {
    return await db.transaction(async (tx) => {
      const product = await tx.query.products.findFirst({ where: eq(products.id, id) });
      if (!product) throw new ApiError(404, "Mahsulot topilmadi");

      const updateData: Partial<typeof products.$inferInsert> = {};

      // Asosiy maydonlar
      if (payload.name) updateData.name = payload.name;
      if (payload.barcode !== undefined) updateData.barcode = payload.barcode;
      if (payload.unit) updateData.unit = payload.unit;
      if (payload.categoryId) updateData.categoryId = Number(payload.categoryId);
      if (payload.currency) updateData.currency = payload.currency as "UZS" | "USD";
      if (payload.image) updateData.image = payload.image;
      if (payload.isActive !== undefined) updateData.isActive = payload.isActive;
      
      // 🔥 Narxlar (yangi maydonlar)
      if (payload.sellingPriceUzs !== undefined) {
        // Narx tarixi
        if (Number(payload.sellingPriceUzs) !== Number(product.sellingPriceUzs)) {
          await tx.insert(priceHistory).values({
            productId: id,
            oldPrice: product.sellingPriceUzs,
            newPrice: String(payload.sellingPriceUzs),
            currency: 'UZS',
            changedBy: userId
          });
        }
        updateData.sellingPriceUzs = String(payload.sellingPriceUzs);
      }
      
      if (payload.sellingPriceUsd !== undefined) {
        if (Number(payload.sellingPriceUsd) !== Number(product.sellingPriceUsd)) {
          await tx.insert(priceHistory).values({
            productId: id,
            oldPrice: product.sellingPriceUsd,
            newPrice: String(payload.sellingPriceUsd),
            currency: 'USD',
            changedBy: userId
          });
        }
        updateData.sellingPriceUsd = String(payload.sellingPriceUsd);
      }
      
      if (payload.incomingPriceUzs !== undefined) updateData.incomingPriceUzs = String(payload.incomingPriceUzs);
      if (payload.incomingPriceUsd !== undefined) updateData.incomingPriceUsd = String(payload.incomingPriceUsd);
      
      // 🔥 Backward compatibility: "price" kelsa
      if (payload.price !== undefined) {
        const currency = payload.currency || product.currency;
        if (currency === 'USD') {
          updateData.sellingPriceUsd = String(payload.price);
        } else {
          updateData.sellingPriceUzs = String(payload.price);
        }
      }
      
      if (payload.discountPrice !== undefined) updateData.discountPrice = String(payload.discountPrice);
      
      updateData.updatedAt = new Date();

      const [updatedProduct] = await tx.update(products)
        .set(updateData)
        .where(eq(products.id, id))
        .returning();

      const result = addVirtualPrice(updatedProduct); // 🔥 Virtual price
      try { getIO().emit("product_updated", result); } catch (e) { /* ignore */ }
      return result;
    });
  },

  // 4. SET DISCOUNT
  setDiscount: async (id: number, payload: SetDiscountInput) => {
    const product = await db.query.products.findFirst({ where: eq(products.id, id) });
    if (!product) throw new ApiError(404, "Mahsulot topilmadi");

    // 🔥 Asl narx = sellingPrice (currency ga qarab)
    const currentPrice = product.currency === 'USD' 
      ? Number(product.sellingPriceUsd) 
      : Number(product.sellingPriceUzs);
    
    let newDiscountPrice = 0;

    if (payload.percent) {
      newDiscountPrice = currentPrice - (currentPrice * (payload.percent / 100));
    } else if (payload.fixedPrice) {
      newDiscountPrice = payload.fixedPrice;
    }

    if (newDiscountPrice >= currentPrice) throw new ApiError(400, "Chegirma narxi asl narxdan past bo'lishi kerak");

    const [updatedProduct] = await db.update(products).set({
        discountPrice: String(newDiscountPrice),
        discountStart: payload.startDate ? new Date(payload.startDate) : new Date(),
        discountEnd: new Date(payload.endDate),
        updatedAt: new Date(),
    }).where(eq(products.id, id)).returning();

    const result = addVirtualPrice(updatedProduct); // 🔥 Virtual price
    try { getIO().emit("product_updated", result); } catch (e) { /* ignore */ }
    return result;
  },

  // 5. REMOVE DISCOUNT
  removeDiscount: async (id: number) => {
    const [updatedProduct] = await db.update(products).set({
        discountPrice: null, discountStart: null, discountEnd: null, updatedAt: new Date(),
    }).where(eq(products.id, id)).returning();

    if (!updatedProduct) throw new ApiError(404, "Mahsulot topilmadi");
    
    const result = addVirtualPrice(updatedProduct); // 🔥 Virtual price
    try { getIO().emit("product_updated", result); } catch (e) { /* ignore */ }
    return result;
  },

  // 6. DELETE
  delete: async (id: number) => {
    const [deleted] = await db.update(products)
      .set({ isDeleted: true, isActive: false, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    if (!deleted) throw new ApiError(404, "Mahsulot topilmadi");
    try { getIO().emit("product_deleted", { id }); } catch (e) { /* ignore */ }
    return deleted;
  },

  // 7. ADD STOCK
  addStock: async (id: number, quantity: number, newPrice: number | undefined, userId: number) => {
    return await db.transaction(async (tx) => {
      const product = await tx.query.products.findFirst({ where: eq(products.id, id) });
      if (!product) throw new ApiError(404, "Mahsulot topilmadi");

      const oldStock = Number(product.stock);
      const newStock = oldStock + quantity;
      
      const updateData: Partial<typeof products.$inferInsert> = { 
        stock: String(newStock), 
        updatedAt: new Date() 
      };
      
      // 🔥 newPrice kelsa, currency ga qarab saqlash
      if (newPrice && newPrice > 0) {
        if (product.currency === 'USD') {
          updateData.sellingPriceUsd = String(newPrice);
        } else {
          updateData.sellingPriceUzs = String(newPrice);
        }
      }

      const [updatedProduct] = await tx.update(products).set(updateData).where(eq(products.id, id)).returning();

      await tx.insert(stockHistory).values({
        productId: id,
        quantity: String(quantity),
        oldStock: String(oldStock),
        newStock: String(newStock),
        newPrice: newPrice ? String(newPrice) : null,
        addedBy: userId,
        note: "Qo'shimcha kirim",
      });

      const result = addVirtualPrice(updatedProduct); // 🔥 Virtual price
      try {
         getIO().emit("stock_update", { id, newStock });
         getIO().emit("product_updated", result);
      } catch (e) { /* ignore */ }

      return result;
    });
  },

  // 8. GET TRENDING
  getTrending: async (limit: number = 20) => {
    const trendingRaw: any = await db.execute(sql`
      SELECT 
        p.*,
        c.name as "categoryName",
        COALESCE(SUM(oi.quantity), 0) as "totalSold"
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
      WHERE p.is_active = true AND p.is_deleted = false
      GROUP BY p.id, c.name
      ORDER BY COALESCE(SUM(oi.quantity), 0) DESC, p.created_at DESC
      LIMIT ${limit}
    `);

    const rows = trendingRaw.rows || trendingRaw;
    return rows.map(addVirtualPrice); // 🔥 Virtual price
  },

  // 9. QUICK SEARCH
  quickSearch: async (query: string, limit: number = 10) => {
    if (!query || query.length < 2) return [];

    const results = await db.query.products.findMany({
      where: and(
        eq(products.isActive, true),
        eq(products.isDeleted, false),
        or(
          ilike(products.name, `%${query}%`),
          ilike(products.barcode, `%${query}%`)
        )
      ),
      limit,
      orderBy: desc(products.createdAt),
      with: { category: true }
    });

    return results.map(addVirtualPrice); // 🔥 Virtual price
  },
};