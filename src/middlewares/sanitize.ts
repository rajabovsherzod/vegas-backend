import { Request, Response, NextFunction } from "express";
import DOMPurify from "isomorphic-dompurify";

/**
 * Input Sanitization Middleware
 * 
 * XSS (Cross-Site Scripting) xavfini oldini olish uchun
 * barcha user input larni tozalaydi.
 * 
 * @example
 * ```ts
 * router.post('/products', sanitizeInput, createProduct);
 * ```
 */

interface SanitizeOptions {
  /**
   * Qaysi fieldlarni sanitize qilmaslik kerak
   */
  skipFields?: string[];

  /**
   * HTML taglarni ruxsat berish
   */
  allowHTML?: boolean;
}

/**
 * Stringni sanitize qilish
 */
function sanitizeString(value: string, allowHTML: boolean = false): string {
  if (typeof value !== 'string') return value;

  // Trim whitespace
  let sanitized = value.trim();

  if (!allowHTML) {
    // HTML taglarni olib tashlash
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: [], // Hech qanday HTML tag yo'q
      ALLOWED_ATTR: [],
    });
  } else {
    // Faqat xavfsiz HTML taglar
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: [],
    });
  }

  return sanitized;
}

/**
 * Objectni recursive sanitize qilish
 */
function sanitizeObject(
  obj: any,
  skipFields: string[] = [],
  allowHTML: boolean = false
): any {
  if (obj === null || obj === undefined) return obj;

  // Array bo'lsa
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, skipFields, allowHTML));
  }

  // Object bo'lsa
  if (typeof obj === 'object') {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip fields
      if (skipFields.includes(key)) {
        sanitized[key] = value;
        continue;
      }

      // String bo'lsa - sanitize
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value, allowHTML);
      }
      // Nested object/array bo'lsa - recursive
      else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value, skipFields, allowHTML);
      }
      // Boshqa tiplar (number, boolean, etc.) - o'zgarishsiz
      else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  return obj;
}

/**
 * Sanitization Middleware
 */
export function sanitizeInput(options: SanitizeOptions = {}) {
  const { skipFields = ['password'], allowHTML = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Body ni sanitize qilish
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, skipFields, allowHTML);
      }

      // Query params ni sanitize qilish
      if (req.query && typeof req.query === 'object') {
        const sanitizedQuery = sanitizeObject(req.query, skipFields, allowHTML);
        // req.query getter bo'lishi mumkin, shuning uchun propertylarini yangilaymiz
        Object.keys(req.query).forEach((key) => {
          try {
            (req.query as any)[key] = sanitizedQuery[key];
          } catch (e) {
            // Read-only property bo'lsa o'tkazib yuboramiz
          }
        });
      }

      // Params ni sanitize qilish
      if (req.params && typeof req.params === 'object') {
        const sanitizedParams = sanitizeObject(req.params, skipFields, allowHTML);
        Object.keys(req.params).forEach((key) => {
          try {
            (req.params as any)[key] = sanitizedParams[key];
          } catch (e) {
            // Read-only property bo'lsa o'tkazib yuboramiz
          }
        });
      }

      next();
    } catch (error) {
      console.error('Sanitization error:', error);
      next(error);
    }
  };
}

/**
 * SQL Injection Prevention
 * 
 * Drizzle ORM allaqachon parameterized queries ishlatadi,
 * lekin qo'shimcha tekshirish uchun.
 */
export function preventSQLInjection(value: string): string {
  if (typeof value !== 'string') return value;

  // Xavfli SQL keywordlar
  const sqlKeywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE',
    'ALTER', 'EXEC', 'EXECUTE', 'SCRIPT', 'UNION', '--', ';--',
    'xp_', 'sp_', 'OR 1=1', 'OR 1 = 1', "' OR '1'='1",
  ];

  const upperValue = value.toUpperCase();

  for (const keyword of sqlKeywords) {
    if (upperValue.includes(keyword)) {
      console.warn(`Potential SQL injection detected: ${keyword}`);
      // Xavfli keyword topilsa, uni escape qilish
      return value.replace(new RegExp(keyword, 'gi'), '');
    }
  }

  return value;
}

/**
 * Path Traversal Prevention
 * 
 * File path lar uchun
 */
export function preventPathTraversal(path: string): string {
  if (typeof path !== 'string') return path;

  // ../ va ..\ ni olib tashlash
  return path.replace(/\.\.[\/\\]/g, '');
}

/**
 * NoSQL Injection Prevention
 * 
 * MongoDB yoki boshqa NoSQL DB lar uchun
 */
export function preventNoSQLInjection(value: any): any {
  if (typeof value === 'object' && value !== null) {
    // $, {, } kabi operatorlarni tekshirish
    const jsonString = JSON.stringify(value);
    if (jsonString.includes('$') || jsonString.includes('{')) {
      console.warn('Potential NoSQL injection detected');
      return {};
    }
  }
  return value;
}

/**
 * Email validation va sanitization
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return email;

  // Lowercase va trim
  let sanitized = email.toLowerCase().trim();

  // Faqat valid email characters
  sanitized = sanitized.replace(/[^a-z0-9@._-]/g, '');

  return sanitized;
}

/**
 * Phone number sanitization
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return phone;

  // Faqat raqamlar va + belgisi
  return phone.replace(/[^0-9+]/g, '');
}

/**
 * URL sanitization
 */
export function sanitizeURL(url: string): string {
  if (typeof url !== 'string') return url;

  try {
    const parsed = new URL(url);

    // Faqat http va https protokollar
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

