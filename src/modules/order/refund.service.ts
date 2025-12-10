import { db } from "@/db";
import { orders, orderItems, products, refunds, refundItems, stockHistory } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm"; 
import ApiError from "@/utils/ApiError";
import logger from "@/utils/logger";
import { getIO } from "@/socket";

interface RefundPayload {
  items: { productId: number; quantity: number }[];
  reason?: string;
  refundedById: number;
}

export const refundService = {

  // 🔥 1. HAMMA QAYTARISHLARNI OLISH (ADMIN UCHUN)
  getAll: async () => {
    const data = await db.query.refunds.findMany({
      orderBy: [desc(refunds.createdAt)],
      with: {
        // Kim qaytardi?
        refundedBy: {
          columns: { fullName: true, username: true }
        },
        // Qaysi orderdan?
        order: {
          columns: { id: true, totalAmount: true, finalAmount: true, customerName: true }, 
          with: {
            partner: { columns: { name: true, phone: true } },
          }
        },
        // 🔥 FIX: MAHSULOT NOMI VA KODINI 100% ANIQLIKDA OLISH
        items: {
          with: {
            product: { 
              columns: { 
                name: true,    // Mahsulot NOMI (Masalan: "Coca Cola")
                unit: true,    // O'lchovi (Masalan: "dona")
                barcode: true  // Kodi (Masalan: "47800...") - Frontendda kerak bo'lsa ishlatish uchun
              } 
            } 
          }
        }
      }
    });
    return data;
  },

  // 🔥 2. QAYTARISH LOGIKASI (Universal - O'zgarishsiz qoldirildi, chunki bu beton)
  processRefund: async (orderId: number, payload: RefundPayload) => {
    return await db.transaction(async (tx) => {
      // 1. Orderni tekshirish
      const order = await tx.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { items: true }
      });

      if (!order) throw new ApiError(404, "Buyurtma topilmadi");
      
      if ((order.status as any) === 'fully_refunded' || order.status === 'cancelled') {
        throw new ApiError(400, "Bu buyurtma allaqachon yopilgan");
      }

      let totalRefundAmount = 0;
      const refundItemsToInsert: any[] = [];
      const stockChanges: { id: number; quantity: number }[] = [];

      // 2. Itemlarni qayta ishlash
      for (const reqItem of payload.items) {
        const originalItem = order.items.find(i => i.productId === reqItem.productId);
        if (!originalItem) continue;

        const refundQty = Number(reqItem.quantity);
        const currentQty = Number(originalItem.quantity);

        if (refundQty > currentQty) {
           throw new ApiError(400, "Xato miqdor (Sotilgandan ko'p qaytarib bo'lmaydi)");
        }

        // Narx va Stock hisob-kitobi
        const unitPrice = Number(originalItem.price); 
        const refundPrice = unitPrice * refundQty;
        totalRefundAmount += refundPrice;

        await tx.execute(sql`UPDATE products SET stock = stock + ${refundQty} WHERE id = ${reqItem.productId}`);
        stockChanges.push({ id: reqItem.productId, quantity: refundQty });

        await tx.insert(stockHistory).values({
           productId: reqItem.productId,
           quantity: String(refundQty),
           addedBy: payload.refundedById,
           note: `Vozvrat: Order #${orderId}`
        });

        // Order item update
        const newQty = currentQty - refundQty;
        const newTotalPrice = unitPrice * newQty;

        if (newQty <= 0) {
           await tx.delete(orderItems).where(eq(orderItems.id, originalItem.id));
        } else {
           await tx.update(orderItems)
             .set({ quantity: String(newQty), totalPrice: String(newTotalPrice) })
             .where(eq(orderItems.id, originalItem.id));
        }

        refundItemsToInsert.push({
           productId: reqItem.productId,
           quantity: String(refundQty),
           price: String(unitPrice)
        });
      }

      // 3. Refunds jadvaliga yozish
      if (totalRefundAmount > 0) {
        const [newRefund] = await tx.insert(refunds).values({
           orderId: orderId,
           totalAmount: String(totalRefundAmount),
           reason: payload.reason || "Mijoz talabi",
           refundedBy: payload.refundedById
        }).returning();

        if (refundItemsToInsert.length > 0) {
           await tx.insert(refundItems).values(
              refundItemsToInsert.map(i => ({ ...i, refundId: newRefund.id }))
           );
        }
      }

      // 4. Status Update
      const remainingItems = await tx.query.orderItems.findMany({
         where: eq(orderItems.orderId, orderId)
      });

      let newStatus: any = order.status;
      let newFinalAmount = 0;

      if (remainingItems.length === 0) {
         newStatus = 'fully_refunded';
         newFinalAmount = 0;
      } else {
         newStatus = 'partially_refunded';
         newFinalAmount = remainingItems.reduce((acc, i) => acc + Number(i.totalPrice), 0);
         const discount = Number(order.discountAmount || 0);
         newFinalAmount = Math.max(0, newFinalAmount - discount);
      }

      await tx.update(orders)
        .set({ status: newStatus, finalAmount: String(newFinalAmount), updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      // 5. Socket
      try {
         const io = getIO();
         io.emit("order_updated", { id: orderId }); 
         io.emit("stock_update", { action: "add", items: stockChanges }); 
         io.emit("order_status_change", { id: orderId, status: newStatus });
      } catch (e) { logger.error(e); }

      return { success: true };
    });
  }
};