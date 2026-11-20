import type { RequestHandler } from 'express';
import { z, type ZodType } from 'zod';
import { AppError, type ErrorDetails } from '../utils/AppError.js';

type Schemas = { body?: ZodType; query?: ZodType; params?: ZodType };
type Part = keyof Schemas;

const PARTS: Part[] = ['params', 'query', 'body'];

/**
 * Validates and coerces request input with zod.
 * Parsed values are stored on `req.validated` (Express 5 makes `req.query` read-only).
 * Controllers read them with `req.validated.query as ListDoctorsQuery` etc.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const details: ErrorDetails = {};
    req.validated ??= {};

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        req.validated[part] = result.data;
        continue;
      }

      const { formErrors, fieldErrors } = z.flattenError(result.error);
      for (const [field, messages] of Object.entries(fieldErrors)) {
        if (Array.isArray(messages) && messages.length) details[field] = messages as string[];
      }
      if (formErrors.length) details[part] = formErrors;
    }

    if (Object.keys(details).length) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request', details));
    }
    next();
  };
}
