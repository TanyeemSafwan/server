import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** `:id` route params. */
export const idParams = z.object({ id: objectId });
export type IdParams = z.infer<typeof idParams>;

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{7,20}$/, 'Enter a valid phone number');

export const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

/** Optional free-text search param; blank becomes undefined. */
export const searchParam = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => v || undefined);

/**
 * Multi-value enum query param. Accepts `?status=a,b` or `?status=a&status=b`.
 * Blank values are ignored; an empty result becomes undefined (no filter).
 */
export function enumListParam<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .preprocess(
      (value) => {
        const list = Array.isArray(value)
          ? value
          : typeof value === 'string'
            ? value.split(',')
            : [];
        const cleaned = list.map((v) => String(v).trim()).filter(Boolean);
        return cleaned.length ? cleaned : undefined;
      },
      z.array(z.enum(values)).max(values.length).optional(),
    )
    .optional();
}
