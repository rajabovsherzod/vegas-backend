import { Router } from "express";
import { 
  createOrder, 
  getOrders, 
  getOrderById, 
  updateOrder, 
  updateOrderStatus,
  markAsPrinted 
} from "./controller";
import { protect, authorize } from "@/middlewares/auth";
import { validate } from "@/middlewares/validate";
import { sanitizeInput } from "@/middlewares/sanitize";

const router = Router();

router.use(protect);

// GET /api/v1/orders - Barcha buyurtmalar
router.get("/", authorize("admin", "owner", "cashier", "seller"), getOrders);

// POST /api/v1/orders - Yangi buyurtma yaratish
router.post(
  "/",
  authorize("admin", "owner", "cashier", "seller"),
  sanitizeInput(),
  createOrder
);

// GET /api/v1/orders/:id - Bitta buyurtma
router.get("/:id", authorize("admin", "owner", "cashier", "seller"), getOrderById);

// PATCH /api/v1/orders/:id - Buyurtmani tahrirlash
router.patch(
  "/:id",
  authorize("admin", "owner", "cashier"),
  sanitizeInput(),
  updateOrder
);

// PATCH /api/v1/orders/:id/status - Status o'zgartirish
router.patch(
  "/:id/status",
  authorize("admin", "owner", "cashier"),
  sanitizeInput(),
  updateOrderStatus
);

// PATCH /api/v1/orders/:id/printed - Chek chiqarildi
router.patch(
  "/:id/printed",
  authorize("admin", "owner", "cashier", "seller"),
  markAsPrinted
);

export default router;