import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';
import { GENDERS, PATIENT_STATUSES } from '../../constants/patients.js';
import { SPECIALIZATIONS } from '../../constants/specializations.js';
import { buildDateRange } from '../../utils/dateRange.js';
import type {
  DashboardRangeQuery,
  Granularity,
  PatientsPerDoctorQuery,
  TrendsQuery,
} from './dashboard.schema.js';

/**
 * Dashboard analytics. Every pipeline starts with an indexed $match
 * on `admissionDate` / `createdAt`; independent queries run in parallel.
 * Dates are bucketed in UTC.
 */

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 30;
const ACTIVE_STATUSES = ['admitted', 'under_treatment'];

type Range = { from: Date; to: Date; $gte: Date; $lt: Date };
type CountRow = { _id: string; count: number };

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Fills in the default range (last 30 days, inclusive of today) and the Mongo bounds. */
export function resolveRange(q: { from?: Date; to?: Date }): Range {
  const to = q.to ?? startOfUtcDay(new Date());
  const from = q.from ?? new Date(to.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
  const bounds = buildDateRange(from, to)!;
  return { from, to, $gte: bounds.$gte!, $lt: bounds.$lt! };
}

/** The equally long period right before `range` (for "vs previous period" deltas). */
function previousRange(range: Range) {
  const length = range.$lt.getTime() - range.$gte.getTime();
  return { $gte: new Date(range.$gte.getTime() - length), $lt: range.$gte };
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null; // null = "new", no meaningful %
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getSummary(q: DashboardRangeQuery) {
  const range = resolveRange(q);
  const current = { $gte: range.$gte, $lt: range.$lt };
  const previous = previousRange(range);

  const [
    totalDoctors,
    totalPatients,
    activePatients,
    newPatients,
    previousNewPatients,
    newDoctors,
    previousNewDoctors,
  ] = await Promise.all([
    Doctor.estimatedDocumentCount(),
    Patient.estimatedDocumentCount(),
    Patient.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
    Patient.countDocuments({ admissionDate: current }),
    Patient.countDocuments({ admissionDate: previous }),
    Doctor.countDocuments({ createdAt: current }),
    Doctor.countDocuments({ createdAt: previous }),
  ]);

  return {
    range: { from: range.from, to: range.to },
    totalDoctors,
    totalPatients,
    activePatients,
    avgPatientsPerDoctor: totalDoctors ? Math.round((totalPatients / totalDoctors) * 10) / 10 : 0,
    newPatients: {
      current: newPatients,
      previous: previousNewPatients,
      changePct: percentChange(newPatients, previousNewPatients),
    },
    newDoctors: {
      current: newDoctors,
      previous: previousNewDoctors,
      changePct: percentChange(newDoctors, previousNewDoctors),
    },
  };
}

function autoGranularity(range: Range): Granularity {
  const days = (range.$lt.getTime() - range.$gte.getTime()) / DAY_MS;
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

/** Mirrors Mongo's $dateTrunc (UTC, weeks start Monday) so JS gap-filling lines up. */
function truncate(date: Date, unit: Granularity) {
  const day = startOfUtcDay(date);
  if (unit === 'day') return day;
  if (unit === 'week') {
    const mondayOffset = (day.getUTCDay() + 6) % 7;
    return new Date(day.getTime() - mondayOffset * DAY_MS);
  }
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

function nextBucket(date: Date, unit: Granularity) {
  if (unit === 'day') return new Date(date.getTime() + DAY_MS);
  if (unit === 'week') return new Date(date.getTime() + 7 * DAY_MS);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/** Every bucket in the range with its count (0 where there were no admissions). */
export function fillBuckets(
  rows: Array<{ _id: Date; count: number }>,
  range: Range,
  unit: Granularity,
) {
  const counts = new Map(rows.map((row) => [row._id.getTime(), row.count]));
  const buckets: Array<{ date: string; count: number }> = [];
  for (
    let bucket = truncate(range.$gte, unit);
    bucket < range.$lt;
    bucket = nextBucket(bucket, unit)
  ) {
    buckets.push({ date: bucket.toISOString(), count: counts.get(bucket.getTime()) ?? 0 });
  }
  return buckets;
}

export async function getTrends(q: TrendsQuery) {
  const range = resolveRange(q);
  const granularity = q.granularity ?? autoGranularity(range);

  const rows = await Patient.aggregate<{ _id: Date; count: number }>([
    { $match: { admissionDate: { $gte: range.$gte, $lt: range.$lt } } },
    {
      $group: {
        _id: {
          $dateTrunc: { date: '$admissionDate', unit: granularity, startOfWeek: 'monday' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    range: { from: range.from, to: range.to },
    granularity,
    points: fillBuckets(rows, range, granularity),
  };
}

export async function getPatientsPerDoctor(q: PatientsPerDoctorQuery) {
  const range = resolveRange(q);

  return Patient.aggregate<{
    doctorId: string;
    name: string;
    specialization: string;
    count: number;
  }>([
    { $match: { admissionDate: { $gte: range.$gte, $lt: range.$lt } } },
    { $group: { _id: '$doctor', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: q.limit },
    // Join only the top-N doctors, not every patient's doctor.
    {
      $lookup: {
        from: Doctor.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'doctor',
        pipeline: [{ $project: { name: 1, specialization: 1 } }],
      },
    },
    { $unwind: '$doctor' },
    {
      $project: {
        _id: 0,
        doctorId: '$_id',
        name: '$doctor.name',
        specialization: '$doctor.specialization',
        count: 1,
      },
    },
  ]);
}

/** Sorted by count; `keys` (when given) are always present, with 0 if missing. */
function toBreakdown(rows: CountRow[], keys?: readonly string[]) {
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  const allKeys = keys ?? rows.map((row) => row._id);
  return allKeys
    .map((key) => ({ key, count: counts.get(key) ?? 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getDistribution(q: DashboardRangeQuery) {
  const range = resolveRange(q);
  const groupBy = (field: string) => [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }];

  const [[patientFacets], specializationRows] = await Promise.all([
    // One pass over the range's patients for all three breakdowns.
    Patient.aggregate<{ byCondition: CountRow[]; byStatus: CountRow[]; byGender: CountRow[] }>([
      { $match: { admissionDate: { $gte: range.$gte, $lt: range.$lt } } },
      {
        $facet: {
          byCondition: groupBy('condition'),
          byStatus: groupBy('status'),
          byGender: groupBy('gender'),
        },
      },
    ]),
    // Doctors by specialization is about the whole team, not the selected range.
    Doctor.aggregate<CountRow>([{ $group: { _id: '$specialization', count: { $sum: 1 } } }]),
  ]);

  return {
    range: { from: range.from, to: range.to },
    byCondition: toBreakdown(patientFacets?.byCondition ?? []),
    byStatus: toBreakdown(patientFacets?.byStatus ?? [], PATIENT_STATUSES),
    byGender: toBreakdown(patientFacets?.byGender ?? [], GENDERS),
    bySpecialization: toBreakdown(specializationRows, SPECIALIZATIONS),
  };
}
