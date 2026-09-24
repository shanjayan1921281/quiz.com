import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, RateLimitRecord>();

export function createRateLimiter(options: { maxRequests: number; windowMs: number; message?: string }) {
  const { maxRequests, windowMs, message } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    let record = ipBuckets.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      ipBuckets.set(key, record);
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: message || 'Too many requests. Please slow down.',
        },
      });
    }

    next();
  };
}

// Pre-configured limiters
export const joinLimiter = createRateLimiter({
  maxRequests: 300,
  windowMs: 60 * 1000,
  message: 'Too many join attempts. Please wait a moment.',
});

export const answerLimiter = createRateLimiter({
  maxRequests: 600,
  windowMs: 60 * 1000,
  message: 'Submission rate limit reached.',
});

export const loginLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000,
  message: 'Too many login attempts. Please try again later.',
});
