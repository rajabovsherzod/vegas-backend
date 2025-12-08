import { Router } from "express";
import { 
  createOrder, 
  getOrders, 
  getOrderById, 
  updateOrder, 
  updateOrderStatus, 
  markAsPrinted,
  refundOrder // 🔥 Yangi controllerni import qildik
} from "./controller";
import { validate } from "../../middlewares/validate";
import { sanitizeInput } from "../../middlewares/sanitize";
import { createOrderSchema, updateOrderSchema, updateOrderStatusSchema } from "./validation";
import { protect, authorize } from "../../middlewares/auth";

const router = Router();

// 1. Hamma so'rovlar uchun himoya (Login qilingan bo'lishi shart)
router.use(protect);

// 2. Global marshrutlar
router.route("/")
  // GET: Hamma orderlar (Controller ichida user roliga qarab filterlanadi)
  .get(authorize('owner', 'cashier', 'seller', 'admin'), getOrders)
  // POST: Yangi order yaratish
  .post(
    sanitizeInput({ skipFields: ['password'] }),
    validate(createOrderSchema),
    createOrder
  );

// 3. Maxsus amallar (ID bilan) - Bularni ID bo'yicha umumiy marshrutdan oldin yozgan ma'qul (ba'zan konflikt bo'lmasligi uchun)

// Status o'zgartirish
router.route("/:id/status")
  .patch(
    authorize('owner', 'cashier', 'admin'),
    sanitizeInput({ skipFields: ['password'] }),
    validate(updateOrderStatusSchema),
    updateOrderStatus
  );

// Chek chiqarilganini belgilash
router.route("/:id/printed")
  .patch(
    authorize('owner', 'cashier', 'seller', 'admin'),
    markAsPrinted
  );

// 🔥 QAYTARISH (REFUND) MARSHRUTI
router.route("/:id/refund")
  .post(
    authorize('owner', 'admin'), // Faqat Owner va Admin qaytara oladi
    refundOrder
  );

// 4. ID bo'yicha umumiy marshrutlar
router.route("/:id")
  // GET: Bitta orderni olish
  .get(authorize('owner', 'admin', 'cashier', 'seller'), getOrderById)
  // PATCH: Tahrirlash
  .patch(
    authorize('owner', 'admin', 'cashier', 'seller'),
    sanitizeInput({ skipFields: ['password'] }),
    validate(updateOrderSchema),
    updateOrder
  );

export default router;