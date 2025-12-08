import { Router } from "express";
import { getStockHistory } from "./controller";
import { protect, authorize } from "@/middlewares/auth";

const router = Router();

router.use(protect);
router.use(authorize('cashier', 'owner'));

router.get("/", getStockHistory);

export default router;