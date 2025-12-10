import { Router } from "express";
import { getStockHistory } from "./controller";
import { protect, authorize } from "@/middlewares/auth";

const router = Router();

router.use(protect);

// GET /api/v1/stock-history
// 🔥 Admin, Owner va Cashier kira oladi
router.get("/", authorize("admin", "owner", "cashier"), getStockHistory);

export default router;