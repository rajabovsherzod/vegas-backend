import { Router } from "express";
import { createUser, deleteUser, getUserById, getUsers, updateUser } from "./controller";
import { validate } from "@/middlewares/validate";
import { createUserSchema, updateUserSchema } from "./validation";
import { protect, authorize } from "@/middlewares/auth"; 

const router = Router();

// 1. Tizimga kirgan bo'lishi shart
router.use(protect); 

// 2. GET / (Hammani ko'rish) - Owner, Admin va Cashier ko'ra olsin (Seller ko'ra olmaydi)
router.get("/", authorize("owner", "admin", "cashier"), getUsers);

// 3. POST / (Yaratish) - 🔥 FAQAT OWNER
// Chunki Admin yoki Cashier o'zidan katta rolni yaratib qo'ymasligi kerak.
router.post("/", authorize("owner"), validate(createUserSchema), createUser);

// 4. ID bo'yicha amallar
router.route("/:id")
  .get(authorize("owner", "admin"), getUserById) // Ko'rish
  .patch(authorize("owner"), validate(updateUserSchema), updateUser) // Tahrirlash (Faqat Owner)
  .delete(authorize("owner"), deleteUser); // O'chirish (Faqat Owner)

export default router;