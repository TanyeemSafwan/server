import { z } from 'zod';
import { SPECIALIZATIONS } from '../../constants/specializations.js';
import { dateRangeShape, invalidRangeMessage, isValidRange } from '../../utils/dateRange.js';
import { paginationShape, sortOrderShape } from '../../utils/pagination.js';
import { email, enumListParam, phone, searchParam } from '../../utils/validation.js';

export const createDoctorBody = z.object({
  // The UI always shows "Dr. <name>", so a typed "Dr." prefix is dropped to avoid "Dr. Dr. …".
  name: z
    .string()
    .trim()
    .transform((v) => v.replace(/^dr\.?\s+/i, ''))
    .pipe(z.string().min(2, 'Name is too short').max(100)),
  specialization: z.enum(SPECIALIZATIONS, 'Choose a specialization'),
  hospital: z.string().trim().min(2, 'Hospital is required').max(120),
  phone,
  email,
});

export const updateDoctorBody = createDoctorBody
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const DOCTOR_SORT_FIELDS = ['createdAt', 'name', 'patientCount'] as const;

export const listDoctorsQuery = z
  .object({
    ...paginationShape,
    ...sortOrderShape,
    ...dateRangeShape,
    search: searchParam,
    specialization: enumListParam(SPECIALIZATIONS),
    hospital: z.string().trim().max(120).optional(),
    sort: z.enum(DOCTOR_SORT_FIELDS).default('createdAt'),
  })
  .refine(isValidRange, invalidRangeMessage);

export const doctorOptionsQuery = z.object({
  search: searchParam,
});

export type CreateDoctorBody = z.infer<typeof createDoctorBody>;
export type UpdateDoctorBody = z.infer<typeof updateDoctorBody>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuery>;
export type DoctorOptionsQuery = z.infer<typeof doctorOptionsQuery>;
