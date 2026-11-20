import type { Query } from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { Doctor } from '../modules/doctors/doctor.model.js';
import { listDoctorsQuery } from '../modules/doctors/doctor.schema.js';
import { buildDoctorFilter } from '../modules/doctors/doctor.service.js';
import { Patient } from '../modules/patients/patient.model.js';
import { listPatientsQuery } from '../modules/patients/patient.schema.js';
import { buildPatientFilter } from '../modules/patients/patient.service.js';
import { logger } from '../utils/logger.js';

/**
 * Prints explain('executionStats') summaries for the main list queries, using the same
 * filter builders as the API. Goal: IXSCAN everywhere, docsExamined ≈ returned.
 * Usage: npm run explain
 */

type PlanNode = { stage?: string; indexName?: string; [key: string]: unknown };

/** Collects stage names and index names from any explain plan shape (classic or SBE). */
function walkPlan(node: unknown, stages: string[], indexes: Set<string>) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((child) => walkPlan(child, stages, indexes));
  const plan = node as PlanNode;
  if (plan.stage) stages.push(plan.stage);
  if (plan.indexName) indexes.add(plan.indexName);
  for (const value of Object.values(plan)) walkPlan(value, stages, indexes);
}

async function summarize(label: string, query: Query<unknown, unknown>) {
  const result = (await query.explain('executionStats')) as unknown as {
    queryPlanner: { winningPlan: unknown };
    executionStats: {
      nReturned: number;
      totalKeysExamined: number;
      totalDocsExamined: number;
      executionTimeMillis: number;
    };
  };
  const stages: string[] = [];
  const indexes = new Set<string>();
  walkPlan(result.queryPlanner.winningPlan, stages, indexes);
  const stats = result.executionStats;
  return {
    query: label,
    scan: stages.includes('COLLSCAN') ? 'COLLSCAN ❌' : 'IXSCAN ✅',
    index: [...indexes].join(' + ') || '-',
    returned: stats.nReturned,
    keysExamined: stats.totalKeysExamined,
    docsExamined: stats.totalDocsExamined,
    ms: stats.executionTimeMillis,
  };
}

async function main() {
  await connectDB();

  const someDoctor = await Doctor.findOne().select('_id').lean();
  if (!someDoctor) throw new Error('No data. Run `npm run seed` first.');
  const doctorId = someDoctor._id.toString();

  const doctorQuery = (raw: Record<string, unknown>) => {
    const q = listDoctorsQuery.parse(raw);
    // Same $match + $sort the list aggregation starts with.
    return Doctor.find(buildDoctorFilter(q))
      .sort({ [q.sort]: q.order === 'asc' ? 1 : -1, _id: -1 })
      .limit(q.limit);
  };
  const patientQuery = (raw: Record<string, unknown>) => {
    const q = listPatientsQuery.parse(raw);
    return Patient.find(buildPatientFilter(q))
      .sort({ [q.sort]: q.order === 'asc' ? 1 : -1, _id: -1 })
      .limit(q.limit);
  };

  const rows = [
    await summarize('doctors: default list', doctorQuery({})),
    await summarize('doctors: search "jo"', doctorQuery({ search: 'jo' })),
    await summarize(
      'doctors: specialization + joined range',
      doctorQuery({ specialization: 'Cardiology', from: '2026-01-01' }),
    ),
    await summarize('patients: default list', patientQuery({})),
    await summarize('patients: search "smi"', patientQuery({ search: 'smi' })),
    await summarize(
      'patients: condition + admission range',
      patientQuery({ condition: 'Diabetes', from: '2026-06-01', to: '2026-09-30' }),
    ),
    await summarize('patients: status', patientQuery({ status: 'admitted' })),
    await summarize("patients: one doctor's list", patientQuery({ doctor: doctorId })),
    await summarize(
      'patients: count for a doctor',
      Patient.find({ doctor: doctorId }).select('_id'),
    ),
  ];

  console.table(rows);
  await disconnectDB();
}

main().catch(async (err) => {
  logger.error('Explain failed', err);
  await disconnectDB();
  process.exit(1);
});
