// src/modules/logs/routes.ts
import { Router } from 'express';

const router = Router();

// Hozircha bo'sh router
router.get('/', (req, res) => {
  res.json({ message: "Logs module working" });
});

export default router;