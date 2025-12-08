import { Router } from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} from "./controller";
import { validate } from "../../middlewares/validate";
import { sanitizeInput } from "../../middlewares/sanitize";
import { createCategorySchema, updateCategorySchema } from "./validation";

const router = Router();

// Asosiy manzillar: POST (Yaratish) va GET (Hammasini olish)
// Endpoint: /api/v1/categories
router.route("/")
  .get(getCategories)
  .post(
    sanitizeInput({ allowHTML: false }),
    validate(createCategorySchema),
    createCategory
  );

// ID bo'yicha manzillar: GET (Bittasini olish), PATCH (Yangilash), DELETE (O'chirish)
// Endpoint: /api/v1/categories/:id
router.route("/:id")
  .get(getCategoryById)
  .patch(
    sanitizeInput({ allowHTML: false }),
    validate(updateCategorySchema),
    updateCategory
  )
  .delete(deleteCategory);

export default router;