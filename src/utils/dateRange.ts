import { z } from 'zod';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `from` / `to` query params as dates (e.g. `2026-01-31`).
 * `to` is inclusive: a whole-day `to` covers that entire day.
 */
export const dateRangeShape = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
};

/** Use with `.refine(...)` on schemas that include `dateRangeShape`. */
export const isValidRange = (q: { from?: Date; to?: Date }) => !q.from || !q.to || q.from <= q.to;
export const invalidRangeMessage = { message: '`from` must be before `to`', path: ['from'] };

/** Mongo range condition for a date field, or `undefined` if neither bound is set. */
export function buildDateRange(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  const range: { $gte?: Date; $lt?: Date } = {};
  if (from) range.$gte = from;
  if (to) {
    // A date-only value (midnight UTC) means "through the end of that day".
    const isWholeDay = to.getTime() % DAY_MS === 0;
    range.$lt = isWholeDay ? new Date(to.getTime() + DAY_MS) : new Date(to.getTime() + 1);
  }
  return range;
}
