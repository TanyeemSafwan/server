import { z } from 'zod';

export const MAX_PAGE_SIZE = 50;

/** Spread into list-query schemas: `z.object({ ...paginationShape, search: ... })`. */
export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
};

export const sortOrderShape = {
  order: z.enum(['asc', 'desc']).default('desc'),
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function toSkip(page: number, limit: number) {
  return (page - 1) * limit;
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
