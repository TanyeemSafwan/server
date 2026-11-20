import type { Request, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { findAuthUser, verifyToken } from '../modules/auth/auth.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * Verifies the JWT cookie and attaches the user to `req.user` (401 otherwise).
 * The user is re-loaded from the DB so deleted users / role changes take effect immediately.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[env.COOKIE_NAME];
  if (typeof token !== 'string' || !token) throw AppError.unauthenticated();

  const { sub } = verifyToken(token);
  const user = await findAuthUser(sub);
  if (!user) throw AppError.unauthenticated('Your account no longer exists.');

  req.user = user;
  next();
};

/** For handlers behind `authenticate`; narrows `req.user` to non-null. */
export function requireUser(req: Request) {
  if (!req.user) throw AppError.unauthenticated();
  return req.user;
}
