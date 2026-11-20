import { faker } from '@faker-js/faker';
import { connectDB, disconnectDB } from '../config/db.js';
import { env, isProd } from '../config/env.js';
import type { Role } from '../config/permissions.js';
import { CONDITIONS, type Condition, type PatientStatus } from '../constants/patients.js';
import { SPECIALIZATIONS, type Specialization } from '../constants/specializations.js';
import { hashPassword } from '../modules/auth/auth.service.js';
import { Doctor } from '../modules/doctors/doctor.model.js';
import { Patient } from '../modules/patients/patient.model.js';
import { User } from '../modules/users/user.model.js';
import { logger } from '../utils/logger.js';

/**
 * Seeds demo users + realistic doctors/patients spread over the last 12 months.
 * Doctors and patients are wiped first. Refuses to run in production without --force.
 * Usage: npm run seed            (local)
 *        npm run seed -- --force (production)
 */

const DOCTOR_COUNT = 60;
const PATIENT_COUNT = 3000;
const DAY_MS = 24 * 60 * 60 * 1000;

const HOSPITALS = [
  'City General Hospital',
  'St. Mary Medical Center',
  'Riverside Clinic',
  'Green Valley Hospital',
  'Northside Medical Center',
  'Lakeside Health',
  "Sunrise Children's Hospital",
  'Metro Heart Institute',
];

/** Conditions each specialization typically treats (picked 75% of the time). */
const CONDITIONS_BY_SPECIALIZATION: Record<Specialization, Condition[]> = {
  Cardiology: ['Heart Disease', 'Hypertension'],
  Dermatology: ['Allergy', 'Other'],
  ENT: ['Allergy', 'Flu'],
  'General Medicine': ['Flu', 'Covid-19', 'Diabetes', 'Hypertension'],
  Gynecology: ['Diabetes', 'Other'],
  Neurology: ['Migraine', 'Other'],
  Oncology: ['Other'],
  Ophthalmology: ['Diabetes', 'Other'],
  Orthopedics: ['Fracture', 'Arthritis'],
  Pediatrics: ['Asthma', 'Flu', 'Allergy'],
  Psychiatry: ['Depression'],
  Radiology: ['Fracture', 'Other'],
};

const NOTES = [
  'Follow-up scheduled in two weeks.',
  'Responding well to treatment.',
  'Monitor blood pressure daily.',
  'Referred for additional lab tests.',
  'Advised rest and hydration.',
  'Medication dosage adjusted.',
  'Family history noted.',
];

type SeedUser = { name: string; email?: string; password?: string; role: Role };

const SEED_USERS: SeedUser[] = [
  {
    name: 'Admin User',
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    role: 'admin',
  },
  {
    name: 'Viewer User',
    email: env.SEED_VIEWER_EMAIL,
    password: env.SEED_VIEWER_PASSWORD,
    role: 'viewer',
  },
];

/** Creates or updates the demo accounts (idempotent). */
async function seedUsers() {
  for (const { name, email, password, role } of SEED_USERS) {
    if (!email || !password) {
      logger.warn(`Skipping ${role} user: SEED_${role.toUpperCase()}_EMAIL/PASSWORD not set`);
      continue;
    }
    await User.updateOne(
      { email },
      { $set: { name, role, passwordHash: await hashPassword(password) } },
      { upsert: true },
    );
    logger.info(`Seeded ${role}: ${email}`);
  }
}

/** Random date between `from` and `to`; `skew` > 1 leans later, < 1 leans earlier. */
function dateBetween(from: number, to: number, skew = 1) {
  return new Date(from + (to - from) * Math.random() ** (1 / skew));
}

function statusFor(admissionDate: Date, now: number): PatientStatus {
  const days = (now - admissionDate.getTime()) / DAY_MS;
  const pick = (options: Array<[PatientStatus, number]>) =>
    faker.helpers.weightedArrayElement(options.map(([value, weight]) => ({ value, weight })));
  if (days < 7)
    return pick([
      ['admitted', 7],
      ['under_treatment', 3],
    ]);
  if (days < 30)
    return pick([
      ['admitted', 2],
      ['under_treatment', 6],
      ['recovered', 1.5],
      ['discharged', 0.5],
    ]);
  return pick([
    ['under_treatment', 1],
    ['recovered', 4.5],
    ['discharged', 4.5],
  ]);
}

/**
 * Builds Mongoose documents and validates them (which also runs the search-token hook),
 * then bulk-inserts the raw objects so our historical `createdAt` values are kept.
 */
async function insertValidated<T extends { validate(): Promise<void>; toObject(): object }>(
  docs: T[],
  insert: (rows: object[]) => Promise<unknown>,
) {
  for (const doc of docs) await doc.validate();
  await insert(docs.map((doc) => doc.toObject()));
}

async function seedDoctorsAndPatients() {
  const now = Date.now();
  const yearAgo = now - 365 * DAY_MS;

  await Promise.all([Doctor.deleteMany({}), Patient.deleteMany({})]);

  const usedEmails = new Set<string>();
  const doctors = Array.from({ length: DOCTOR_COUNT }, () => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    let email = faker.internet.email({ firstName, lastName, provider: 'doctortracker.dev' });
    while (usedEmails.has(email.toLowerCase())) {
      email = faker.internet.email({ firstName, lastName, provider: 'doctortracker.dev' });
    }
    usedEmails.add(email.toLowerCase());
    // Most doctors joined early in the year so they have history; a few are recent.
    const createdAt = dateBetween(yearAgo, now - 14 * DAY_MS, 0.5);
    return new Doctor({
      name: `${firstName} ${lastName}`,
      specialization: faker.helpers.arrayElement(SPECIALIZATIONS),
      hospital: faker.helpers.arrayElement(HOSPITALS),
      phone: faker.phone.number({ style: 'international' }),
      email,
      createdAt,
      updatedAt: createdAt,
    });
  });
  await insertValidated(doctors, (rows) => Doctor.collection.insertMany(rows));

  // Some doctors are much busier than others (makes "patients per doctor" interesting).
  const weightedDoctors = doctors.map((doctor) => ({
    value: doctor,
    weight: faker.number.float({ min: 0.3, max: 3 }),
  }));

  const patients = Array.from({ length: PATIENT_COUNT }, () => {
    const doctor = faker.helpers.weightedArrayElement(weightedDoctors);
    const specialization = doctor.specialization as Specialization;
    const sex = faker.helpers.weightedArrayElement([
      { value: 'male' as const, weight: 48 },
      { value: 'female' as const, weight: 48 },
      { value: 'other' as const, weight: 4 },
    ]);
    const firstName = faker.person.firstName(sex === 'other' ? undefined : sex);
    const lastName = faker.person.lastName();
    const condition = faker.datatype.boolean(0.75)
      ? faker.helpers.arrayElement(CONDITIONS_BY_SPECIALIZATION[specialization])
      : faker.helpers.arrayElement(CONDITIONS);
    const age =
      specialization === 'Pediatrics'
        ? faker.number.int({ min: 0, max: 17 })
        : faker.number.int({ min: 18, max: 90 });
    // Admissions after the doctor joined, leaning recent (shows growth on the trend chart).
    const from = Math.max(yearAgo, doctor.createdAt.getTime());
    const admissionDate = dateBetween(from, now, 1.6);

    return new Patient({
      name: `${firstName} ${lastName}`,
      age,
      gender: sex,
      phone: faker.phone.number({ style: 'international' }),
      email: faker.datatype.boolean(0.7)
        ? faker.internet.email({ firstName, lastName }).toLowerCase()
        : undefined,
      condition,
      status: statusFor(admissionDate, now),
      admissionDate,
      doctor: doctor._id,
      notes: faker.datatype.boolean(0.4) ? faker.helpers.arrayElement(NOTES) : undefined,
      createdAt: admissionDate,
      updatedAt: admissionDate,
    });
  });
  await insertValidated(patients, (rows) => Patient.collection.insertMany(rows));

  logger.info(`Seeded ${doctors.length} doctors and ${patients.length} patients`);
}

async function main() {
  if (isProd && !process.argv.includes('--force')) {
    logger.error('Refusing to wipe data in production. Re-run with: npm run seed -- --force');
    process.exit(1);
  }

  faker.seed(2026); // deterministic data → reproducible screenshots
  await connectDB();
  await Promise.all([User.syncIndexes(), Doctor.syncIndexes(), Patient.syncIndexes()]);
  await seedUsers();
  await seedDoctorsAndPatients();
  await disconnectDB();
}

main().catch(async (err) => {
  logger.error('Seed failed', err);
  await disconnectDB();
  process.exit(1);
});
