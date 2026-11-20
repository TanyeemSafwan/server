import type { RequestHandler } from 'express';
import { hasPermission, type Permission } from '../config/permissions.js';
import { AppError } from '../utils/AppError.js';

/** Use after `authenticate`: `router.post('/', authenticate, authorize('doctor:write'), ...)`. */
export function authorize(...required: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthenticated());
    const allowed = required.every((permission) => hasPermission(req.user!.role, permission));
    if (!allowed) return next(AppError.forbidden());
    next();
  };
}
