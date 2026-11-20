import { z } from 'zod';
import { CONDITIONS, GENDERS, PATIENT_STATUSES } from '../../constants/patients.js';
import { dateRangeShape, invalidRangeMessage, isValidRange } from '../../utils/dateRange.js';
import { paginationShape, sortOrderShape } from '../../utils/pagination.js';
import { email, enumListParam, objectId, phone, searchParam } from '../../utils/validation.js';

const patientFields = {
  name: z.string().trim().min(2, 'Name is too short').max(100),
  age: z.coerce.number().int().min(0, 'Age must be 0 or more').max(120, 'Age must be 120 or less'),
  gender: z.enum(GENDERS, 'Choose a gender'),
  phone,
  // Optional: an empty string from a form means "no email".
  email: z.union([z.literal('').transform(() => undefined), email]).optional(),
  condition: z.enum(CONDITIONS, 'Choose a condition'),
  status: z.enum(PATIENT_STATUSES).default('admitted'),
  admissionDate: z.coerce
    .date()
    .refine(
      (d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000,
      'Admission date is in the future',
    )
    .optional(),
  notes: z.string().trim().max(1000).optional(),
};

/** POST /doctors/:id/patients — doctor comes from the URL. */
export const createPatientForDoctorBody = z.object(patientFields);

/** POST /patients — doctor chosen in the form. */
export const createPatientBody = z.object({ ...patientFields, doctor: objectId });

export const updatePatientBody = z
  .object({ ...patientFields, status: z.enum(PATIENT_STATUSES), doctor: objectId })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const PATIENT_SORT_FIELDS = ['admissionDate', 'name', 'age', 'createdAt'] as const;

const listPatientsShape = {
  ...paginationShape,
  ...sortOrderShape,
  ...dateRangeShape,
  search: searchParam,
  condition: enumListParam(CONDITIONS),
  status: enumListParam(PATIENT_STATUSES),
  gender: enumListParam(GENDERS),
  ageMin: z.coerce.number().int().min(0).max(120).optional(),
  ageMax: z.coerce.number().int().min(0).max(120).optional(),
  sort: z.enum(PATIENT_SORT_FIELDS).default('admissionDate'),
};

const isValidAgeRange = (q: { ageMin?: number; ageMax?: number }) =>
  q.ageMin === undefined || q.ageMax === undefined || q.ageMin <= q.ageMax;
const invalidAgeMessage = { message: '`ageMin` must be at most `ageMax`', path: ['ageMin'] };

export const listPatientsQuery = z
  .object({ ...listPatientsShape, doctor: objectId.optional() })
  .refine(isValidRange, invalidRangeMessage)
  .refine(isValidAgeRange, invalidAgeMessage);

/** GET /doctors/:id/patients — same filters, doctor fixed by the URL. */
export const listDoctorPatientsQuery = z
  .object(listPatientsShape)
  .refine(isValidRange, invalidRangeMessage)
  .refine(isValidAgeRange, invalidAgeMessage);

export type CreatePatientForDoctorBody = z.infer<typeof createPatientForDoctorBody>;
export type CreatePatientBody = z.infer<typeof createPatientBody>;
export type UpdatePatientBody = z.infer<typeof updatePatientBody>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuery>;
