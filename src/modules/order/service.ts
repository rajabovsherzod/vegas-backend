import { db } from "@/db";
import { orders, orderItems, products, NewOrder } from "@/db/schema";
import { eq, inArray, desc, ne, and, sql } from "drizzle-orm";
import ApiError from "@/utils/ApiError";
import logger from "@/utils/logger";
import { getIO } from "@/socket";
import { CreateOrderInput, UpdateOrderStatusInput, UpdateOrderInput } from "./validation";

export const orderService = {
  
  // 1. GET BY SELLER ID (Sotuvchining o'z buyurtmalari)
  getBySellerId: async (sellerId: number) => {
    if (!sellerId) throw new ApiError(400, "Seller ID kiritilmagan");

    return await db.query.orders.findMany({
      where: and(
        eq(orders.sellerId, sellerId),
        ne(orders.status, 'fully_refunded') // To'liq qaytarilganlar ko'rinmaydi
      ),
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      with: {
        seller: { columns: { fullName: true, username: true } },
        partner: { columns: { name: true, phone: true } },
        items: { with: { product: true } }
      }
    });
  },

  // 2. CREATE (Yangi buyurtma)
  create: async (userId: number, payload: CreateOrderInput) => {
    return await db.transaction(async (tx) => {
      const currentRate = parseFloat(String(payload.exchangeRate || "1"));
      const productIds = payload.items.map((item) => item.productId);

      if (productIds.length === 0) throw new ApiError(400, "Mahsulotlar tanlanmagan");

      const dbProducts = await tx.query.products.findMany({
        where: inArray(products.id, productIds),
      });

      let totalAmount = 0;
      let itemsTotal = 0;
      const itemsToInsert: any[] = [];
      const stockChanges: { id: number; quantity: number }[] = [];

      for (const item of payload.items) {
        const product = dbProducts.find((p) => p.id === item.productId);
        if (!product || !product.isActive || product.isDeleted) {
          throw new ApiError(400, `Mahsulot xatosi (ID: ${item.productId})`);
        }

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

        stockChanges.push({ id: product.id, quantity: requestQty });

        const originalPrice = Number(product.price);
        let soldPrice = item.price !== undefined ? Number(item.price) : originalPrice;

        if (item.price === undefined && Number(product.discountPrice) > 0) {
            soldPrice = Number(product.discountPrice);
        }

        if (product.currency === 'USD') {
          soldPrice = soldPrice * currentRate;
        }
        const originalPriceInUzs = product.currency === 'USD' ? originalPrice * currentRate : originalPrice;

        const lineTotalOriginal = originalPriceInUzs * requestQty;
        const lineTotalSold = soldPrice * requestQty;

        totalAmount += lineTotalOriginal;
        itemsTotal += lineTotalSold;

        itemsToInsert.push({
          productId: product.id,
          quantity: String(requestQty),
          price: String(soldPrice),
          originalPrice: String(originalPriceInUzs),
          totalPrice: String(lineTotalSold),
          manualDiscountValue: String(item.manualDiscountValue || 0),
          manualDiscountType: item.manualDiscountType || 'fixed',
        });
      }

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

      const newOrderData: NewOrder = {
        sellerId: userId,
        partnerId: payload.partnerId ?? null,
        customerName: payload.customerName || null,
        totalAmount: String(totalAmount),
        discountAmount: String(globalDiscountAmount),
        finalAmount: String(finalAmount),
        discountValue: String(discountValue),
        discountType: discountType,
        currency: 'UZS',
        exchangeRate: String(currentRate),
        status: 'draft',
        type: payload.type as any,
        paymentMethod: payload.paymentMethod as any,
      };

      const [newOrder] = await tx.insert(orders).values(newOrderData).returning();

      if (itemsToInsert.length > 0) {
        await tx.insert(orderItems).values(
          itemsToInsert.map(item => ({ ...item, orderId: newOrder.id }))
        );
      }

      try {
        const io = getIO();
        // 🔥 Cashierlarga xabar beramiz
        io.to("cashier_room").emit("new_order", {
          id: newOrder.id,
          sellerId: userId,
          customerName: newOrder.customerName,
          totalAmount: newOrder.totalAmount,
          createdAt: newOrder.createdAt
        });
        // 🔥 Hamma sellerlarga stock kamayganini bildiramiz
        io.emit("stock_update", { action: "subtract", items: stockChanges });
      } catch (error) { logger.error("Socket error:", error); }

      return newOrder;
    });
  },

  // 3. GET ALL (Cashier uchun)
  getAll: async () => {
    return await db.query.orders.findMany({
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      where: ne(orders.status, 'fully_refunded'), 
      with: {
        seller: { columns: { fullName: true, username: true } },
        partner: { columns: { name: true, phone: true } },
        items: { with: { product: true } }
      }
    });
  },

  // 4. GET BY ID
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

  // 5. UPDATE STATUS (Tasdiqlash/Bekor qilish)
  updateStatus: async (orderId: number, adminId: number, payload: UpdateOrderStatusInput) => {
    return await db.transaction(async (tx) => {
      const order = await tx.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { items: true }
      });

      if (!order) throw new ApiError(404, "Buyurtma topilmadi");
      
      if (order.status !== 'draft' && payload.status === 'cancelled') {
         throw new ApiError(400, "Faqat kutilayotgan buyurtmalarni bekor qilish mumkin");
      }

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
        try { 
            // 🔥 Cashier xonasiga xabar
            getIO().to("cashier_room").emit("order_status_change", { id: orderId, status: "completed" }); 
        } 
        catch (e) { logger.error(e); }
      }

      return updatedOrder;
    });
  },

  // 6. UPDATE ORDER (Edit)
  update: async (orderId: number, userId: number, userRole: string, payload: UpdateOrderInput) => {
    return await db.transaction(async (tx) => {
      const order = await tx.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { items: true }
      });

      if (!order) throw new ApiError(404, "Buyurtma topilmadi");
      if (order.status !== 'draft') throw new ApiError(400, "Faqat kutilayotgan orderlar tahrirlanadi");
      if (userRole === 'seller' && order.sellerId !== userId) throw new ApiError(403, "Ruxsat yo'q");

      const oldItemsMap = new Map(order.items.map(item => [item.productId, Number(item.quantity)]));
      const newItemsMap = new Map(payload.items.map(item => [item.productId, Number(item.quantity)]));

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

      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

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

        const productStock = (await tx.query.products.findFirst({ where: eq(products.id, product.id) }))?.stock || '0';
        if (Number(productStock) < 0) {
            throw new ApiError(409, `Omborda yetarli emas: ${product.name}`);
        }

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

      // 🔥 SOCKET: Bu global bo'lishi kerak, seller va cashier ham ko'radi
      try {
        const io = getIO();
        io.emit("order_updated", { 
          id: orderId, 
          sellerId: order.sellerId, 
          updatedBy: userId, 
          totalAmount: updatedOrder.finalAmount 
        });
      } catch (e) { logger.error(e); }

      return updatedOrder;
    });
  },

  // 7. MARK AS PRINTED
  markAsPrinted: async (id: number) => {
    const [updatedOrder] = await db.update(orders)
      .set({ isPrinted: true })
      .where(eq(orders.id, id))
      .returning();
  
    if (!updatedOrder) throw new ApiError(404, "Buyurtma topilmadi");
  
    const io = getIO();
    // 🔥 Cashier xonasiga xabar
    io.to("cashier_room").emit("order_printed", updatedOrder);
  
    return updatedOrder;
  }
};