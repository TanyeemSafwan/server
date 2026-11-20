import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { buildDateRange } from '../../utils/dateRange.js';
import { buildMeta, toSkip } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import { assertDoctorExists } from '../doctors/doctor.service.js';
import { Patient, type PatientAttrs } from './patient.model.js';
import type { CreatePatientBody, ListPatientsQuery, UpdatePatientBody } from './patient.schema.js';

const DOCTOR_SUMMARY_FIELDS = 'name specialization hospital';

type PatientFilterInput = Omit<ListPatientsQuery, 'page' | 'limit' | 'sort' | 'order'>;

/** Exported for scripts/explain.ts so explain() runs the exact production filter. */
export function buildPatientFilter(q: PatientFilterInput): QueryFilter<PatientAttrs> {
  const filter: QueryFilter<PatientAttrs> = { ...buildSearchFilter(q.search) };
  if (q.doctor) filter.doctor = q.doctor;
  if (q.condition?.length) filter.condition = { $in: q.condition };
  if (q.status?.length) filter.status = { $in: q.status };
  if (q.gender?.length) filter.gender = { $in: q.gender };
  if (q.ageMin !== undefined || q.ageMax !== undefined) {
    filter.age = {
      ...(q.ageMin !== undefined && { $gte: q.ageMin }),
      ...(q.ageMax !== undefined && { $lte: q.ageMax }),
    };
  }
  const admissionDate = buildDateRange(q.from, q.to);
  if (admissionDate) filter.admissionDate = admissionDate;
  return filter;
}

export async function listPatients(q: ListPatientsQuery) {
  const filter = buildPatientFilter(q);
  const direction = q.order === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    Patient.find(filter)
      .sort({ [q.sort]: direction, _id: direction })
      .skip(toSkip(q.page, q.limit))
      .limit(q.limit)
      .select('-__v')
      .populate('doctor', DOCTOR_SUMMARY_FIELDS)
      .lean(),
    // Empty filter → O(1) collection metadata count instead of scanning.
    Object.keys(filter).length ? Patient.countDocuments(filter) : Patient.estimatedDocumentCount(),
  ]);

  return { data, meta: buildMeta(q.page, q.limit, total) };
}

export async function getPatient(id: string) {
  const patient = await Patient.findById(id)
    .select('-__v')
    .populate('doctor', DOCTOR_SUMMARY_FIELDS)
    .lean();
  if (!patient) throw AppError.notFound('Patient not found');
  return patient;
}

export async function createPatient(body: CreatePatientBody) {
  await assertDoctorExists(body.doctor);
  const patient = await new Patient(body).save();
  await patient.populate('doctor', DOCTOR_SUMMARY_FIELDS);
  return patient.toJSON();
}

export async function updatePatient(id: string, body: UpdatePatientBody) {
  const patient = await Patient.findById(id);
  if (!patient) throw AppError.notFound('Patient not found');
  if (body.doctor && body.doctor !== patient.doctor?.toString()) {
    await assertDoctorExists(body.doctor);
  }
  patient.set(body);
  await patient.save(); // save() so validation + search-token hook run
  await patient.populate('doctor', DOCTOR_SUMMARY_FIELDS);
  return patient.toJSON();
}

export async function deletePatient(id: string) {
  const { deletedCount } = await Patient.deleteOne({ _id: id });
  if (!deletedCount) throw AppError.notFound('Patient not found');
}
