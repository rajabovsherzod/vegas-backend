import { Router } from "express";
import { refundOrder, getAllRefunds } from "./refund.controller";
import { protect, authorize } from "@/middlewares/auth";
import { validate } from "@/middlewares/validate";
import { refundOrderSchema } from "../order/validation"; 

const router = Router();

router.use(protect);

// GET /api/v1/refunds
router.get("/", authorize("admin", "owner"), getAllRefunds);

// POST /api/v1/refunds/:id
router.post(
  "/:id", 
  authorize("admin", "owner"), 
  validate(refundOrderSchema), 
  refundOrder
);

export default router;