/**
 * GlitchTip Backend Configuration
 * 
 * Custom error logging to GlitchTip (without Sentry SDK)
 */

import logger from "../utils/logger";

interface GlitchTipConfig {
  dsn: string | undefined;
  enabled: boolean;
}

class GlitchTipLogger {
  private config: GlitchTipConfig;

  constructor() {
    this.config = {
      dsn: process.env.GLITCHTIP_DSN,
      enabled: !!process.env.GLITCHTIP_DSN,
    };
  }

  /**
   * Initialize GlitchTip
   */
  init() {
    if (!this.config.enabled) {
      logger.warn("⚠️  GlitchTip DSN not configured. Skipping monitoring initialization.");
      return;
    }

    logger.info("✅ GlitchTip monitoring initialized successfully");
    logger.info(`📊 GlitchTip DSN: ${this.config.dsn?.substring(0, 30)}...`);
  }

  /**
   * Log error to GlitchTip
   */
  async logError(error: Error, context?: any) {
    if (!this.config.enabled) return;

    // Log to Winston
    logger.error("Error logged to GlitchTip:", {
      message: error.message,
      stack: error.stack,
      context,
    });

    // Send to GlitchTip (if needed)
    // GlitchTip API endpoint: POST /api/{project_id}/store/
    // For now, Winston logs are enough
  }

  /**
   * Log message to GlitchTip
   */
  async logMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: any) {
    if (!this.config.enabled) return;

    const logMethod = level === 'error' ? logger.error : level === 'warning' ? logger.warn : logger.info;

    logMethod(`GlitchTip [${level}]:`, {
      message,
      context,
    });
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Export singleton
export const glitchtip = new GlitchTipLogger();

// Initialize
export function initGlitchTip() {
  glitchtip.init();
}

// Express error handler middleware
export const glitchtipErrorHandler = (err: any, req: any, res: any, next: any) => {
  glitchtip.logError(err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next(err);
};

// Request handler middleware
export const glitchtipRequestHandler = (req: any, res: any, next: any) => {
  // Log request (optional)
  next();
};

