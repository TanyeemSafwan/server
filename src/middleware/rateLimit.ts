import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** 5 failed login attempts per IP + email per 15 minutes. Successful logins don't count. */
export const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  },
  handler: (_req, _res, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many login attempts. Try again in a few minutes.'));
  },
});
