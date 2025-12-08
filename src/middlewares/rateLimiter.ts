import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request, Response } from "express";

/**
 * Advanced Rate Limiting
 * 
 * Har xil endpoint lar uchun turli rate limitlar.
 * Brute force va DDoS hujumlardan himoya.
 */

/**
 * Custom key generator - IP va User ID asosida
 * IPv6 compatible - ipKeyGenerator helper funksiyasidan foydalanadi
 */
function generateKey(req: Request): string {
  const userId = (req as any).user?.id;

  // Agar user login qilgan bo'lsa, user ID ishlatamiz
  if (userId) {
    return `user:${userId}`;
  }

  // IPv6 compatible IP address - ipKeyGenerator helper funksiyasidan foydalanadi
  const ip = ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
  return `ip:${ip}`;
}


/**
 * Custom error handler
 */
function rateLimitHandler(req: Request, res: Response) {
  res.status(429).json({
    success: false,
    message: "Juda ko'p so'rov yuborildi. Iltimos, biroz kuting va qayta urinib ko'ring.",
    error: "TOO_MANY_REQUESTS",
    retryAfter: res.getHeader('Retry-After'),
  });
}

/**
 * Global Rate Limiter
 * 
 * Barcha API endpointlar uchun
 * 15 daqiqada 1000 ta request
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: "Juda ko'p so'rov. Iltimos, biroz kuting.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: (req) => {
    // Health check endpointlarni skip qilish
    return req.path === '/health' || req.path === '/api/health';
  },
});

/**
 * Auth Rate Limiter (Stricter)
 * 
 * Login, Register endpointlar uchun
 * 15 daqiqada 5 ta urinish
 * 
 * Brute force hujumlardan himoya
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Juda ko'p login urinishlari. 15 daqiqadan keyin qayta urinib ko'ring.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Username va IP asosida - IPv6 compatible
    const username = req.body?.username || 'unknown';
    const ip = ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
    return `auth:${username}:${ip}`;
  },
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Muvaffaqiyatli loginlarni hisobga olmaslik
});

/**
 * Create/Write Rate Limiter
 * 
 * POST, PUT, PATCH endpointlar uchun
 * 1 daqiqada 30 ta request
 * 
 * Spam va abuse dan himoya
 */
export const createLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: "Juda ko'p ma'lumot yaratilmoqda. Iltimos, sekinroq ishlang.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Read Rate Limiter
 * 
 * GET endpointlar uchun
 * 1 daqiqada 100 ta request
 */
export const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: "Juda ko'p ma'lumot so'ralmoqda. Iltimos, sekinroq ishlang.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Delete Rate Limiter (Very Strict)
 * 
 * DELETE endpointlar uchun
 * 1 soatda 10 ta request
 * 
 * Accidental yoki malicious deletion dan himoya
 */
export const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 deletes per hour
  message: "Juda ko'p o'chirish operatsiyasi. 1 soatdan keyin qayta urinib ko'ring.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * File Upload Rate Limiter
 * 
 * File upload endpointlar uchun
 * 1 daqiqada 5 ta file
 */
export const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // 5 uploads per minute
  message: "Juda ko'p fayl yuklanyapti. Iltimos, sekinroq ishlang.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Search Rate Limiter
 * 
 * Search endpointlar uchun
 * 1 daqiqada 20 ta search
 */
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 searches per minute
  message: "Juda ko'p qidiruv so'rovi. Iltimos, sekinroq ishlang.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Export Rate Limiter
 * 
 * Export/Report endpointlar uchun
 * 1 soatda 5 ta export
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 exports per hour
  message: "Juda ko'p export operatsiyasi. 1 soatdan keyin qayta urinib ko'ring.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Dynamic Rate Limiter Factory
 * 
 * Custom rate limiter yaratish uchun
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || "Juda ko'p so'rov.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    handler: rateLimitHandler,
  });
}

/**
 * Rate Limit Info Middleware
 * 
 * Response headerga rate limit ma'lumotlarini qo'shadi
 */
export function rateLimitInfo(req: Request, res: Response, next: any) {
  // Custom header qo'shish
  res.setHeader('X-RateLimit-Policy', 'vegas-crm-v1');
  next();
}

