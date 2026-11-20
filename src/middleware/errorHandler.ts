import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError, z } from 'zod';
import { isProd } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

type ErrorBody = {
  error: { code: string; message: string; details?: Record<string, string[]>; stack?: string };
};

function isDuplicateKeyError(
  err: unknown,
): err is { code: number; keyValue?: Record<string, unknown> } {
  return err instanceof mongoose.mongo.MongoServerError && err.code === 11000;
}

/** Errors thrown by express.json() carry an http status and a `type`. */
function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err;
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    const { fieldErrors } = z.flattenError(err);
    return new AppError(
      400,
      'VALIDATION_ERROR',
      'Invalid request',
      fieldErrors as Record<string, string[]>,
    );
  }

  if (err instanceof mongoose.Error.CastError) {
    return new AppError(400, 'INVALID_ID', `Invalid value for ${err.path}`);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, [e.message]]),
    );
    return new AppError(400, 'VALIDATION_ERROR', 'Invalid request', details);
  }

  if (isDuplicateKeyError(err)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    return AppError.conflict(`A record with this ${field} already exists`, {
      [field]: [`This ${field} is already in use`],
    });
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
    }
    if (err.type === 'entity.too.large') {
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    }
  }

  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = toAppError(err);

  if (appError.status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed`, err);
  }

  const body: ErrorBody = {
    error: { code: appError.code, message: appError.message },
  };
  if (appError.details) body.error.details = appError.details;
  if (!isProd && appError.status >= 500 && err instanceof Error) body.error.stack = err.stack;

  res.status(appError.status).json(body);
};
