import { z } from 'zod';
import { dateRangeShape, invalidRangeMessage, isValidRange } from '../../utils/dateRange.js';

const MAX_RANGE_DAYS = 5 * 366;

const isReasonableRange = (q: { from?: Date; to?: Date }) =>
  !q.from || !q.to || (q.to.getTime() - q.from.getTime()) / 86_400_000 <= MAX_RANGE_DAYS;
const tooLongMessage = { message: 'Date range can be at most 5 years', path: ['from'] };

/** `from`/`to` default to the last 30 days (see resolveRange in the service). */
export const dashboardRangeQuery = z
  .object(dateRangeShape)
  .refine(isValidRange, invalidRangeMessage)
  .refine(isReasonableRange, tooLongMessage);

export const GRANULARITIES = ['day', 'week', 'month'] as const;

export const trendsQuery = z
  .object({
    ...dateRangeShape,
    // Omitted → picked from the range length (day ≤ 31d, week ≤ 180d, else month).
    granularity: z.enum(GRANULARITIES).optional(),
  })
  .refine(isValidRange, invalidRangeMessage)
  .refine(isReasonableRange, tooLongMessage);

export const patientsPerDoctorQuery = z
  .object({
    ...dateRangeShape,
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  .refine(isValidRange, invalidRangeMessage)
  .refine(isReasonableRange, tooLongMessage);

export type DashboardRangeQuery = z.infer<typeof dashboardRangeQuery>;
export type TrendsQuery = z.infer<typeof trendsQuery>;
export type Granularity = (typeof GRANULARITIES)[number];
export type PatientsPerDoctorQuery = z.infer<typeof patientsPerDoctorQuery>;
