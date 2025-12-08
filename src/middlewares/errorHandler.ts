import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import logger from "../utils/logger";
import { logsService } from "../modules/logs/service"; // Endi bu fayl bor!

const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    error = new ApiError(statusCode, message, error?.errors || [], error.stack);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || "Something went wrong";

  // Winston logger (asosiy log)
  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
    stack: error.stack,
    errors: error.errors,
  });

  const userId = (req as any).user?.id || null;

  // Logs service ga yozish
  // try-catch ishlatamiz, chunki logsService.create promise qaytaradi
  logsService.create({
    message: `[Backend] ${statusCode} - ${message}`,
    stack: error.stack || null,
    url: req.originalUrl || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info',
    context: JSON.stringify({
      method: req.method,
      statusCode,
      errors: error.errors,
      body: req.body,
      query: req.query,
      params: req.params,
    }) as any,
    ip: req.ip || null,
    userId,
  }).catch((dbError: any) => { // Type 'any' deb belgilandi
    // Bazaga yozish o'xshamasa, server to'xtab qolmasligi kerak
    console.error('Failed to save log via service:', dbError);
  });

  res.status(statusCode).json({
    success: false,
    message,
    errors: error.errors,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  });
};

export default errorHandler;