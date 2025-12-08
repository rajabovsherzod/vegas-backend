import { Router } from "express";
import { 
  createProduct, 
  deleteProduct, 
  getProducts, 
  updateProduct, 
  addStock,
  setDiscount,
  removeDiscount
} from "./controller";
import { validate } from "@/middlewares/validate";
import { sanitizeInput } from "@/middlewares/sanitize";
import { createProductSchema, updateProductSchema, addStockSchema, setDiscountSchema } from "./validation";
import { protect, authorize } from "@/middlewares/auth"; 

const router = Router();

// 🔥 Hamma route'lar himoyalangan bo'lishi shart!
router.use(protect); 

// 1. GET ALL (Faqat login qilganlar)
router.get("/", getProducts);

// 2. CREATE (Faqat Owner va Admin, agar kerak bo'lsa)
// Yoki Seller ham qila oladi desangiz, authorize ni olib tashlang
router.post(
  "/",
  // authorize('owner', 'admin'), 
  sanitizeInput({ skipFields: ['password'] }),
  validate(createProductSchema),
  createProduct
);

// 3. ADD STOCK (Kirim qilish)
router.post(
  "/:id/stock",
  sanitizeInput(),
  validate(addStockSchema),
  addStock
);

// CHEGIRMA ROUTELARI (ID li routelardan oldin qo'yish shart emas, lekin tartib uchun yaxshi)
router.post(
  "/:id/discount",
  sanitizeInput(),
  validate(setDiscountSchema),
  setDiscount
);

router.delete(
  "/:id/discount",
  removeDiscount
);

// 4. UPDATE & DELETE
router.route("/:id")
  .patch(
    sanitizeInput({ skipFields: ['password'] }),
    validate(updateProductSchema),
    updateProduct
  )
  .delete(
    // authorize('owner', 'admin'), // O'chirishni cheklash mumkin
    deleteProduct
  );

export default router;