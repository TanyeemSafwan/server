import { Types, type PipelineStage, type QueryFilter } from 'mongoose';
import { SPECIALIZATIONS } from '../../constants/specializations.js';
import { AppError } from '../../utils/AppError.js';
import { buildDateRange } from '../../utils/dateRange.js';
import { buildMeta, toSkip } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import { Patient } from '../patients/patient.model.js';
import { Doctor, type DoctorAttrs } from './doctor.model.js';
import type {
  CreateDoctorBody,
  DoctorOptionsQuery,
  ListDoctorsQuery,
  UpdateDoctorBody,
} from './doctor.schema.js';

type DoctorFilterInput = Pick<
  ListDoctorsQuery,
  'search' | 'specialization' | 'hospital' | 'from' | 'to'
>;

/** Exported for scripts/explain.ts so explain() runs the exact production filter. */
export function buildDoctorFilter(q: DoctorFilterInput): QueryFilter<DoctorAttrs> {
  const filter: QueryFilter<DoctorAttrs> = { ...buildSearchFilter(q.search) };
  if (q.specialization?.length) filter.specialization = { $in: q.specialization };
  if (q.hospital) filter.hospital = q.hospital;
  const createdAt = buildDateRange(q.from, q.to);
  if (createdAt) filter.createdAt = createdAt;
  return filter;
}

/** Adds `patientCount` per doctor. Uses the `{ doctor: 1, admissionDate: -1 }` patient index. */
const patientCountStages: PipelineStage[] = [
  {
    $lookup: {
      from: Patient.collection.name,
      localField: '_id',
      foreignField: 'doctor',
      as: 'patientStats',
      pipeline: [{ $count: 'count' }],
    },
  },
  { $addFields: { patientCount: { $ifNull: [{ $first: '$patientStats.count' }, 0] } } },
];

export async function listDoctors(q: ListDoctorsQuery) {
  const filter = buildDoctorFilter(q);
  const direction = q.order === 'asc' ? 1 : -1;
  // `_id` tiebreaker keeps pagination stable when sort values are equal.
  const sortStage: PipelineStage = { $sort: { [q.sort]: direction, _id: direction } };
  const pageStages: PipelineStage[] = [{ $skip: toSkip(q.page, q.limit) }, { $limit: q.limit }];

  // Only count patients for the doctors on this page, unless we must sort by the count.
  const stages: PipelineStage[] =
    q.sort === 'patientCount'
      ? [...patientCountStages, sortStage, ...pageStages]
      : [sortStage, ...pageStages, ...patientCountStages];

  const [data, total] = await Promise.all([
    Doctor.aggregate([
      { $match: filter },
      ...stages,
      { $project: { patientStats: 0, searchTokens: 0, __v: 0 } },
    ]),
    Object.keys(filter).length ? Doctor.countDocuments(filter) : Doctor.estimatedDocumentCount(),
  ]);

  return { data, meta: buildMeta(q.page, q.limit, total) };
}

/** Lightweight list for doctor pickers (comboboxes). */
export function listDoctorOptions(q: DoctorOptionsQuery) {
  return Doctor.find(buildSearchFilter(q.search))
    .select('name specialization hospital')
    .sort({ name: 1 })
    .limit(20)
    .lean();
}

export async function getDoctorFilterOptions() {
  const hospitals = await Doctor.distinct('hospital');
  return { specializations: SPECIALIZATIONS, hospitals: hospitals.sort() };
}

export async function getDoctor(id: string) {
  const doctorId = new Types.ObjectId(id);
  const [doctor, statusCounts] = await Promise.all([
    Doctor.findById(doctorId).select('-__v').lean(),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: { doctor: doctorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  if (!doctor) throw AppError.notFound('Doctor not found');

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  const patientCount = statusCounts.reduce((sum, s) => sum + s.count, 0);
  return { ...doctor, patientCount, patientsByStatus: byStatus };
}

export async function assertDoctorExists(id: string) {
  const exists = await Doctor.exists({ _id: id });
  if (!exists) throw AppError.notFound('Doctor not found');
}

export async function createDoctor(body: CreateDoctorBody) {
  const doctor = await new Doctor(body).save();
  return doctor.toJSON();
}

export async function updateDoctor(id: string, body: UpdateDoctorBody) {
  const doctor = await Doctor.findById(id);
  if (!doctor) throw AppError.notFound('Doctor not found');
  doctor.set(body);
  await doctor.save(); // save() (not findByIdAndUpdate) so validation + search-token hook run
  return doctor.toJSON();
}

export async function deleteDoctor(id: string) {
  const patientCount = await Patient.countDocuments({ doctor: id });
  if (patientCount > 0) {
    throw AppError.conflict(
      `This doctor still has ${patientCount} patient(s). Reassign or delete them first.`,
    );
  }
  const { deletedCount } = await Doctor.deleteOne({ _id: id });
  if (!deletedCount) throw AppError.notFound('Doctor not found');
}
