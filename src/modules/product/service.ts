import { db } from "@/db";
import { products, stockHistory } from "@/db/schema";
import { eq, desc, ilike, or, sql, SQL, and } from "drizzle-orm";
import ApiError from "@/utils/ApiError";
import logger from "@/utils/logger";
import { getIO } from "@/socket"; 
import { CreateProductInput, UpdateProductInput, SetDiscountInput } from "./validation";

export const productService = {
  // 1. GET ALL
  getAll: async (query: any) => {
    const { search, limit = "20", page = "1", categoryId, showHidden } = query;
    const limitNum = Number(limit);
    const offsetNum = (Number(page) - 1) * limitNum;

    const conditions: SQL[] = [];
    conditions.push(eq(products.isDeleted, false));

    if (showHidden !== 'true') {
      conditions.push(eq(products.isActive, true));
    }

    if (search) {
      conditions.push(or(ilike(products.name, `%${search}%`), ilike(products.barcode, `%${search}%`))!);
    }
    if (categoryId && categoryId !== "all") {
      conditions.push(eq(products.categoryId, Number(categoryId)));
    }

    const data = await db.query.products.findMany({
      where: (table, { and }) => and(...conditions),
      limit: limitNum,
      offset: offsetNum,
      orderBy: desc(products.createdAt),
      with: { category: true },
    });

    const totalRes = await db.select({ count: sql<number>`count(*)` }).from(products).where(and(...conditions));
    const total = Number(totalRes[0].count);

    return {
      products: data,
      pagination: {
        page: Number(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  },

  // 2. CREATE (TRANSACTION BILAN)
  create: async (payload: CreateProductInput, userId?: number) => {
    return await db.transaction(async (tx) => {
      // Barcode tekshirish
      const existing = await tx.query.products.findFirst({
        where: eq(products.barcode, payload.barcode),
      });
      if (existing) throw new ApiError(400, "Bu shtrix-kod allaqachon mavjud!");

      // Mahsulot yaratish
      const [newProduct] = await tx.insert(products).values({
        ...payload,
        price: String(payload.price),
        stock: String(payload.stock),
        originalPrice: payload.originalPrice ? String(payload.originalPrice) : null,
        categoryId: payload.categoryId ? Number(payload.categoryId) : null,
      }).returning();

      // Tarixga yozish (Agar boshlang'ich soni bo'lsa)
      if (Number(payload.stock) > 0) {
        await tx.insert(stockHistory).values({
          productId: newProduct.id,
          quantity: String(payload.stock),
          oldStock: "0",
          newStock: String(payload.stock),
          newPrice: payload.originalPrice ? String(payload.originalPrice) : null,
          addedBy: userId || null,
          note: "Dastlabki kirim",
        });
      }

      logger.info(`Mahsulot yaratildi. ID: ${newProduct.id}`);
      try {
        getIO().emit("new_product", newProduct);
      } catch (e) { console.error("Socket error:", e); }

      return newProduct;
    });
  },

  // 3. UPDATE (Stock o'zgarishi taqiqlangan)
  update: async (id: number, payload: UpdateProductInput) => {
    if (payload.barcode) {
      const existing = await db.query.products.findFirst({
        where: eq(products.barcode, payload.barcode),
      });
      if (existing && existing.id !== id) {
        throw new ApiError(400, "Bu shtrix-kod boshqa mahsulotda mavjud!");
      }
    }

    const updateData: any = { ...payload };
    delete updateData.stock; // 🔥 Stock faqat Add Stock orqali o'zgaradi

    if (payload.price !== undefined) updateData.price = String(payload.price);
    if (payload.originalPrice !== undefined) updateData.originalPrice = String(payload.originalPrice);
    
    updateData.updatedAt = new Date();

    const [updatedProduct] = await db
      .update(products)
      .set(updateData)
      .where(and(eq(products.id, id), eq(products.isDeleted, false)))
      .returning();

    if (!updatedProduct) throw new ApiError(404, "Mahsulot topilmadi");

    logger.info(`Mahsulot yangilandi. ID: ${id}`);
    try {
      getIO().emit("product_update", updatedProduct);
    } catch (e) { console.error("Socket error:", e); }

    return updatedProduct;
  },

  setDiscount: async (id: number, payload: SetDiscountInput) => {
    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!product) throw new ApiError(404, "Mahsulot topilmadi");

    const currentPrice = Number(product.price);
    let newDiscountPrice = 0;

    // A) Agar foiz berilgan bo'lsa (masalan 10%)
    if (payload.percent) {
      const discountAmount = currentPrice * (payload.percent / 100);
      newDiscountPrice = currentPrice - discountAmount;
    } 
    // B) Agar aniq narx berilgan bo'lsa (masalan 9000)
    else if (payload.fixedPrice) {
      newDiscountPrice = payload.fixedPrice;
    }

    // Xavfsizlik: Chegirma narxi asl narxdan qimmat bo'lib ketmasin
    if (newDiscountPrice >= currentPrice) {
      throw new ApiError(400, "Chegirma narxi asl narxdan past bo'lishi kerak");
    }

    const [updatedProduct] = await db
      .update(products)
      .set({
        discountPrice: String(newDiscountPrice),
        discountStart: payload.startDate ? new Date(payload.startDate) : new Date(),
        discountEnd: new Date(payload.endDate),
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    logger.info(`Chegirma qo'yildi. ID: ${id}, Yangi narx: ${newDiscountPrice}`);
    
    // Socket orqali hammaga (Kassirga) yangi narxni yuboramiz
    try { getIO().emit("product_update", updatedProduct); } catch (e) {}

    return updatedProduct;
  },

  removeDiscount: async (id: number) => {
    const [updatedProduct] = await db
      .update(products)
      .set({
        discountPrice: null,
        discountStart: null,
        discountEnd: null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return updatedProduct;
  },

  // 4. SOFT DELETE
  delete: async (id: number) => {
    const [deleted] = await db
      .update(products)
      .set({
        isDeleted: true,
        updatedAt: new Date()
      })
      .where(and(eq(products.id, id), eq(products.isDeleted, false)))
      .returning();

    if (!deleted) throw new ApiError(404, "Mahsulot topilmadi");

    logger.info(`Mahsulot o'chirildi (Soft Delete). ID: ${id}`);
    try {
      getIO().emit("product_delete", { id });
    } catch (e) { console.error("Socket error:", e); }

    return deleted;
  },

  // 5. ADD STOCK (Kirim qilish + Tarix)
  addStock: async (id: number, quantity: number, newPrice?: number, userId?: number) => {
    return await db.transaction(async (tx) => {
      const product = await tx.query.products.findFirst({
        where: eq(products.id, id)
      });

      if (!product) throw new ApiError(404, "Mahsulot topilmadi");

      const currentStock = Number(product.stock);
      const newStock = currentStock + quantity;

      const updateData: any = {
        stock: String(newStock),
        updatedAt: new Date(),
      };

      if (newPrice !== undefined && newPrice > 0) {
        updateData.price = String(newPrice);
      }

      // Products jadvalini yangilash
      const [updatedProduct] = await tx
        .update(products)
        .set(updateData)
        .where(eq(products.id, id))
        .returning();

      // Tarixga yozish
      await tx.insert(stockHistory).values({
        productId: id,
        quantity: String(quantity),
        oldStock: String(currentStock),
        newStock: String(newStock),
        newPrice: newPrice ? String(newPrice) : null,
        addedBy: userId || null,
        note: "Qo'shimcha kirim (Add Stock)",
      });

      logger.info(`Mahsulot kirim qilindi. ID: ${id}, +${quantity}`);
      try {
        getIO().emit("product_update", updatedProduct);
      } catch (e) { console.error("Socket error:", e); }

      return updatedProduct;
    });
  }
};