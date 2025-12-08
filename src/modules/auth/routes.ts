import { Router } from "express";
import { login, getMe } from "./controller";
import { protect } from "../../middlewares/auth";

const router = Router();

// POST /api/v1/auth/login
router.post("/login", login);
router.get("/me", protect, getMe);

export default router;