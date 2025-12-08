import { db } from "@/db";
import { orders, orderItems, products, NewOrder, refunds, refundItems } from "@/db/schema";
import { eq, inArray, sql, desc } from "drizzle-orm";
import ApiError from "@/utils/ApiError";
import logger from "@/utils/logger";
import { getIO } from "@/socket";
import { CreateOrderInput, UpdateOrderStatusInput, UpdateOrderInput } from "./validation";

interface RefundItemsPayload {
  items: { 
    productId: number; 
    quantity: number 
  }[];
  reason?: string;
  refundedById: number; // Kim qaytardi (Admin)
}

export const orderService = {
  
  /**
   * 1. GET BY SELLER ID
   */
  getBySellerId: async (sellerId: number) => {
    if (!sellerId) throw new ApiError(400, "Seller ID kiritilmagan");

    return await db.query.orders.findMany({
      where: eq(orders.sellerId, sellerId),
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      with: {
        seller: { columns: { fullName: true, username: true } },
        partner: { columns: { name: true, phone: true } },
        items: { with: { product: true } }
      }
    });
  },

  /**
   * 2. CREATE (BETON NARX VA CHEGIRMA LOGIKASI)
   */
  create: async (userId: number, payload: CreateOrderInput) => {
    return await db.transaction(async (tx) => {
      const currentRate = parseFloat(String(payload.exchangeRate || "1"));
      const productIds = payload.items.map((item) => item.productId);

      if (productIds.length === 0) throw new ApiError(400, "Mahsulotlar tanlanmagan");

      const dbProducts = await tx.query.products.findMany({
        where: inArray(products.id, productIds),
      });

      let totalAmount = 0; // Asl narxlar yig'indisi (Chegirmasiz)
      let itemsTotal = 0;  // Item chegirmalari ayirilgan summa
      const itemsToInsert: any[] = [];
      const changedStocks: { id: number; quantity: number }[] = [];

      for (const item of payload.items) {
        const product = dbProducts.find((p) => p.id === item.productId);
        if (!product || !product.isActive || product.isDeleted) {
          throw new ApiError(400, `Mahsulot xatosi (ID: ${item.productId})`);
        }

        // 1. Stock Tekshirish va Yangilash
        const currentStock = Number(product.stock);
        const requestQty = Number(item.quantity);

        if (currentStock < requestQty) {
          throw new ApiError(409, `Omborda yetarli emas: ${product.name}`);
        }

        await tx.update(products)
          .set({
            stock: String(currentStock - requestQty),
            updatedAt: new Date()
          })
          .where(eq(products.id, product.id));

        changedStocks.push({ id: product.id, quantity: requestQty });

        // 2. Narx Mantiqi (Item Price Logic)
        const originalPrice = Number(product.price); // Katalogdagi asl narx
        
        // Sotiladigan narxni aniqlash:
        // A) Agar frontend 'price' yuborgan bo'lsa (Manual Discount), o'shani olamiz.
        // B) Agar yubormagan bo'lsa, lekin mahsulotda AKSIYA (discountPrice) bo'lsa, o'shani olamiz.
        // C) Bo'lmasa, asl narxni olamiz.
        let soldPrice = item.price !== undefined ? Number(item.price) : originalPrice;

        if (item.price === undefined && Number(product.discountPrice) > 0) {
            soldPrice = Number(product.discountPrice);
        }

        // Valyuta konvertatsiyasi (USD -> UZS)
        if (product.currency === 'USD') {
          soldPrice = soldPrice * currentRate;
          // originalPrice ni ham UZS ga o'giramiz (totalAmount hisobi uchun)
        }
        const originalPriceInUzs = product.currency === 'USD' ? originalPrice * currentRate : originalPrice;

        // Summalarni hisoblash
        const lineTotalOriginal = originalPriceInUzs * requestQty;
        const lineTotalSold = soldPrice * requestQty;

        totalAmount += lineTotalOriginal;
        itemsTotal += lineTotalSold;

        itemsToInsert.push({
          productId: product.id,
          quantity: String(requestQty),
          price: String(soldPrice), // Sotilgan narx
          originalPrice: String(originalPriceInUzs), // Asl narx (Statistika va Vozvrat uchun)
          totalPrice: String(lineTotalSold),

          // 🔥 YANGI: Item Discount Tarixi
          manualDiscountValue: String(item.manualDiscountValue || 0),
          manualDiscountType: item.manualDiscountType || 'fixed',
        });
      }

      // 3. Umumiy Chegirma Mantiqi (Global Discount Logic)
      const discountValue = Number(payload.discountValue || 0);
      const discountType = payload.discountType || 'fixed';
      
      let globalDiscountAmount = 0;

      if (discountValue > 0) {
        if (discountType === 'percent') {
          // Foiz bo'lsa: Itemlar yig'indisidan foiz olinadi
          globalDiscountAmount = itemsTotal * (discountValue / 100);
        } else {
          // Fixed bo'lsa: Aniq summa
          globalDiscountAmount = discountValue;
        }
      }

      // Final Summa
      const finalAmount = itemsTotal - globalDiscountAmount;

      if (finalAmount < 0) throw new ApiError(400, "Chegirma summasi umumiy summadan oshib ketdi");

      // 4. Order Yaratish
      const newOrderData: NewOrder = {
        sellerId: userId,
        partnerId: payload.partnerId ?? null,
        customerName: payload.customerName || null,
        
        totalAmount: String(totalAmount),       // Chegirmasiz to'liq summa
        discountAmount: String(globalDiscountAmount), // Hisoblangan umumiy chegirma
        finalAmount: String(finalAmount),       // To'lanadigan summa
        
        // 🔥 Chegirma "Retsepti"
        discountValue: String(discountValue),   
        discountType: discountType,
        
        currency: 'UZS',
        exchangeRate: String(currentRate),
        status: 'draft',
        type: payload.type as any,
        paymentMethod: payload.paymentMethod as any,
      };

      const [newOrder] = await tx.insert(orders).values(newOrderData).returning();

      // Items ulash
      if (itemsToInsert.length > 0) {
        await tx.insert(orderItems).values(
          itemsToInsert.map(item => ({ ...item, orderId: newOrder.id }))
        );
      }

      // Socket Notification
      try {
        const io = getIO();
        io.to("admin_room").emit("new_order", {
          id: newOrder.id,
          sellerId: userId,
          customerName: newOrder.customerName,
          totalAmount: newOrder.totalAmount,
          createdAt: newOrder.createdAt
        });
        io.emit("stock_update", { action: "subtract", items: changedStocks });
      } catch (error) { logger.error("Socket error:", error); }

      return newOrder;
    });
  },

  /**
   * 3. GET ALL
   */
  getAll: async () => {
    return await db.query.orders.findMany({
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      with: {
        seller: { columns: { fullName: true, username: true } },
        partner: { columns: { name: true, phone: true } },
        items: { with: { product: true } }
      }
    });
  },

  /**
   * 4. GET BY ID
   */
  getById: async (orderId: number) => {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        seller: { columns: { id: true, fullName: true, username: true } },
        partner: { columns: { id: true, name: true, phone: true } },
        items: { with: { product: true } }
      }
    });
    if (!order) throw new ApiError(404, "Buyurtma topilmadi");
    return order;
  },

  /**
   * 5. UPDATE STATUS
   */
  updateStatus: async (orderId: number, adminId: number, payload: UpdateOrderStatusInput) => {
    return await db.transaction(async (tx) => {
      const order = await tx.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { items: true }
      });

      if (!order) throw new ApiError(404, "Buyurtma topilmadi");
      
      // Status validatsiyasi
      if (order.status !== 'draft' && payload.status === 'cancelled') {
         throw new ApiError(400, "Faqat kutilayotgan buyurtmalarni bekor qilish mumkin");
      }

      // Bekor qilish logikasi (Stock qaytarish)
      if (payload.status === 'cancelled') {
        const restoredStocks: { id: number; quantity: number }[] = [];
        for (const item of order.items) {
          await tx.execute(
            sql`UPDATE products SET stock = stock + ${item.quantity} WHERE id = ${item.productId}`
          );
          restoredStocks.push({ id: item.productId, quantity: Number(item.quantity) });
        }
        try {
          const io = getIO();
          io.emit("stock_update", { action: "add", items: restoredStocks });
          io.emit("order_status_change", { id: orderId, status: "cancelled" });
        } catch (e) { logger.error(e); }
      }

      const [updatedOrder] = await tx.update(orders)
        .set({
          status: payload.status as any,
          cashierId: adminId,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (payload.status === 'completed') {
        try { getIO().emit("order_status_change", { id: orderId, status: "completed" }); } 
        catch (e) { logger.error(e); }
      }

      return updatedOrder;
    });
  },

  /**
   * 6. UPDATE ORDER (EDIT) - (BETON YANGILASH)
   */
  update: async (orderId: number, userId: number, userRole: string, payload: UpdateOrderInput) => {
    return await db.transaction(async (tx) => {
      // 1. Orderni tekshirish
      const order = await tx.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { items: true }
      });

      if (!order) throw new ApiError(404, "Buyurtma topilmadi");
      if (order.status !== 'draft') throw new ApiError(400, "Faqat kutilayotgan orderlar tahrirlanadi");
      if (userRole === 'seller' && order.sellerId !== userId) throw new ApiError(403, "Ruxsat yo'q");

      const oldItemsMap = new Map(order.items.map(item => [item.productId, Number(item.quantity)]));
      const newItemsMap = new Map(payload.items.map(item => [item.productId, Number(item.quantity)]));

      // 2. STOCK O'ZGARISHLARINI HISOBLASH
      const allProductIds = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);

      for (const productId of allProductIds) {
        const oldQty = oldItemsMap.get(productId) || 0;
        const newQty = newItemsMap.get(productId) || 0;
        const diff = newQty - oldQty;

        if (diff === 0) continue; 

        if (diff > 0) { 
          await tx.execute(sql`UPDATE products SET stock = stock - ${diff} WHERE id = ${productId}`);
        } else { 
          const returnQty = Math.abs(diff);
          await tx.execute(sql`UPDATE products SET stock = stock + ${returnQty} WHERE id = ${productId}`);
        }
      }

      // Eski itemsni o'chirish
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

      // 3. YANGI ITEMLARNI QO'SHISH
      const newItems = payload.items;
      const newProductIds = newItems.map(item => item.productId);
      const dbProducts = await tx.query.products.findMany({ where: inArray(products.id, newProductIds) });

      let totalAmount = 0;
      let itemsTotal = 0;
      const itemsToInsert: any[] = [];
      const currentRate = parseFloat(String(payload.exchangeRate || order.exchangeRate || "1"));

      for (const newItem of newItems) {
        const product = dbProducts.find(p => p.id === newItem.productId);
        if (!product || !product.isActive) throw new ApiError(400, "Xato mahsulot");

        // Stock yetarliligini tekshirish (faqat manfiy bo'lib ketmasligi uchun)
        const productStock = (await tx.query.products.findFirst({ where: eq(products.id, product.id) }))?.stock || '0';
        if (Number(productStock) < 0) {
            throw new ApiError(409, `Omborda yetarli emas: ${product.name}`);
        }

        // Narx Mantiqi
        const originalPrice = Number(product.price);
        let soldPrice = newItem.price !== undefined ? Number(newItem.price) : originalPrice;

        if (newItem.price === undefined && Number(product.discountPrice) > 0) {
            soldPrice = Number(product.discountPrice);
        }

        if (product.currency === 'USD') {
          soldPrice = soldPrice * currentRate;
        }
        const originalPriceInUzs = product.currency === 'USD' ? originalPrice * currentRate : originalPrice;

        const lineTotalOriginal = originalPriceInUzs * Number(newItem.quantity);
        const lineTotalSold = soldPrice * Number(newItem.quantity);

        totalAmount += lineTotalOriginal;
        itemsTotal += lineTotalSold;

        itemsToInsert.push({
          orderId: orderId,
          productId: product.id,
          quantity: String(newItem.quantity),
          price: String(soldPrice),
          originalPrice: String(originalPriceInUzs),
          totalPrice: String(lineTotalSold),
          manualDiscountValue: String(newItem.manualDiscountValue || 0),
          manualDiscountType: newItem.manualDiscountType || 'fixed',
        });
      }

      if (itemsToInsert.length > 0) {
        await tx.insert(orderItems).values(itemsToInsert);
      }

      // UMUMIY CHEGIRMA
      const discountValue = Number(payload.discountValue || 0);
      const discountType = payload.discountType || 'fixed';
      
      let globalDiscountAmount = 0;
      if (discountValue > 0) {
        if (discountType === 'percent') {
          globalDiscountAmount = itemsTotal * (discountValue / 100);
        } else {
          globalDiscountAmount = discountValue;
        }
      }
      
      const finalAmount = itemsTotal - globalDiscountAmount;
      if (finalAmount < 0) throw new ApiError(400, "Chegirma xato");

      const [updatedOrder] = await tx.update(orders)
        .set({
          customerName: payload.customerName ?? order.customerName,
          paymentMethod: (payload.paymentMethod ?? order.paymentMethod) as any,
          type: (payload.type ?? order.type) as any,
          exchangeRate: String(currentRate),
          totalAmount: String(totalAmount),
          discountAmount: String(globalDiscountAmount),
          finalAmount: String(finalAmount),
          discountValue: String(discountValue),
          discountType: discountType,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      // 🔥 SOCKET REAL-TIME FIX 🔥
      try {
        const io = getIO();
        
        // OLDIN: io.to("admin_room").emit(...) edi (faqat adminlar ko'rardi)
        // HOZIR: io.emit(...) (Hamma ko'radi, Seller ham)
        
        io.emit("order_updated", { 
          id: orderId, 
          sellerId: order.sellerId, // Kimniki ekanini bildirish uchun
          updatedBy: userId,        // Kim o'zgartirganini bildirish uchun
          totalAmount: updatedOrder.finalAmount 
        });

      } catch (e) { logger.error(e); }

      return updatedOrder;
    });
  },

  /**
   * 7. MARK AS PRINTED
   */
  markAsPrinted: async (id: number) => {
    const [updatedOrder] = await db.update(orders)
      .set({ isPrinted: true })
      .where(eq(orders.id, id))
      .returning();
  
    if (!updatedOrder) throw new ApiError(404, "Buyurtma topilmadi");
  
    const io = getIO();
    io.to("admin_room").emit("order_printed", updatedOrder);
  
    return updatedOrder;
  },


  refund: async (orderId: number, payload: RefundItemsPayload): Promise<any> => {
    return await db.transaction(async (tx) => {
      // 1. Order va uning itemlarini olamiz
      const order = await tx.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { items: true }
      });

      if (!order) throw new ApiError(404, "Buyurtma topilmadi");
      if (order.status === 'fully_refunded' || order.status === 'cancelled') {
        throw new ApiError(400, "Bu buyurtma allaqachon yopilgan");
      }

      let totalRefundAmount = 0;

      // 2. Har bir qaytarilayotgan mahsulot bo'yicha aylanamiz
      for (const item of payload.items) {
        const originalItem = order.items.find(i => i.productId === item.productId);
        
        if (!originalItem) continue; // Agar bunday mahsulot orderda bo'lmasa, o'tkazib yuboramiz

        const refundQty = Number(item.quantity);
        const currentQty = Number(originalItem.quantity);

        if (refundQty > currentQty) {
           throw new ApiError(400, `Mahsulot sonidan ko'p qaytara olmaysiz! (Mavjud: ${currentQty}, So'raldi: ${refundQty})`);
        }

        // A) Stockni (Omborni) ko'paytiramiz
        await tx
          .update(products)
          .set({ 
            stock: sql`${products.stock} + ${refundQty}`,
            updatedAt: new Date()
          })
          .where(eq(products.id, item.productId));

        // B) Qaytariladigan summani hisoblaymiz
        // (Jami narx / Jami son) = 1 dona mahsulotning real sotilgan narxi
        const unitPrice = Number(originalItem.totalPrice) / currentQty;
        const refundPrice = unitPrice * refundQty;
        
        totalRefundAmount += refundPrice;

        // C) 🔥 MUHIM: ORDER ITEMNI YANGILASH (SONINI KAMAYTIRISH)
        const newQty = currentQty - refundQty;
        const newTotalPrice = unitPrice * newQty;

        if (newQty <= 0) {
          // Agar hammasi qaytarilsa -> qatorni o'chiramiz
          await tx.delete(orderItems).where(eq(orderItems.id, originalItem.id));
        } else {
          // Qisman qaytarilsa -> sonini va summasini yangilaymiz
          await tx.update(orderItems)
            .set({
              quantity: newQty.toString(),       // Yangi son
              totalPrice: newTotalPrice.toString() // Yangi summa
            })
            .where(eq(orderItems.id, originalItem.id));
        }
      }

      // 3. Refunds tarixiga yozish
      if (totalRefundAmount > 0) {
        await tx.insert(refunds).values({
          orderId: orderId,
          totalAmount: totalRefundAmount.toString(),
          reason: payload.reason || "Qaytarish",
          refundedBy: payload.refundedById,
        });
      }

      // 4. Asosiy Order summasini va statusini yangilash
      // Hozir bazada qolgan itemlarni qayta tekshiramiz
      const remainingItems = await tx.query.orderItems.findMany({
        where: eq(orderItems.orderId, orderId)
      });

      let newStatus: any = order.status;
      let newFinalAmount = 0;

      if (remainingItems.length === 0) {
        // Hamma narsa qaytib ketdi -> Bekor qilindi/To'liq qaytdi
        newStatus = 'fully_refunded';
        newFinalAmount = 0;
      } else {
        // Hali narsalar bor -> Qisman qaytdi
        newStatus = 'partially_refunded';
        // Qolgan itemlar summasini yig'amiz
        newFinalAmount = remainingItems.reduce((acc, i) => acc + Number(i.totalPrice), 0);
      }

      // Orderni yangilaymiz
      await tx.update(orders)
        .set({ 
            status: newStatus as any, 
            finalAmount: newFinalAmount.toString(),
            updatedAt: new Date() 
        })
        .where(eq(orders.id, orderId));

      return { success: true, message: "Muvaffaqiyatli qaytarildi" };
    });
  },
  
};