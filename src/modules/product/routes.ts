import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  addStock,
  setDiscount,
  removeDiscount,
  getTrendingProducts,
  quickSearchProducts
} from "./controller";
import { validate } from "@/middlewares/validate";
import { sanitizeInput } from "@/middlewares/sanitize";
import { createProductSchema, updateProductSchema, addStockSchema, setDiscountSchema } from "./validation";
import { protect, authorize } from "@/middlewares/auth";

const router = Router();
router.use(protect); 

// 1. GET ALL
router.get("/", getProducts);

// --- MAXSUS (STATIC) ROUTE'LARNI TEPAGA QO'YING ---

// TRENDING
// Bu yerda ID yo'q, shuning uchun /:id dan oldin kelishi SHART
router.get("/trending", authorize('owner', 'admin', 'cashier', 'seller'), getTrendingProducts);

// QUICK SEARCH
// Bu ham /:id dan oldin turishi kerak
router.get("/search", authorize('owner', 'admin', 'cashier', 'seller'), quickSearchProducts);

// ----------------------------------------------------

// 2. CREATE
router.post(
  "/",
  authorize('owner', 'admin', 'cashier'),
  sanitizeInput({ skipFields: ['password'] }),
  validate(createProductSchema),
  createProduct
);

// 3. ADD STOCK
router.post(
  "/:id/stock", // Bu yerda aniq :id/stock bo'lgani uchun ziddiyat kamroq, lekin pastda tursa yaxshi
  authorize('owner', 'admin', 'cashier'),
  sanitizeInput(),
  validate(addStockSchema),
  addStock
);

// ... Discount route'lari ...

// 6. UPDATE & DELETE & GET SINGLE (DINAMIK ID)
// Bu eng oxirida turishi kerak, chunki bu hamma narsani (masalan "trending" so'zini ham) ID deb qabul qilishi mumkin.
router.route("/:id")
  .patch(
    authorize('owner', 'admin', 'cashier'),
    sanitizeInput(),
    validate(updateProductSchema),
    updateProduct
  )
  .delete(
    authorize('owner', 'admin', 'cashier'),
    deleteProduct
  );
  // Agar get single product bo'lsa: .get(getProductById) 

export default router;