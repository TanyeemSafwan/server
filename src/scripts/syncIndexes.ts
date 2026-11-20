import { connectDB, disconnectDB } from '../config/db.js';
import { Doctor } from '../modules/doctors/doctor.model.js';
import { Patient } from '../modules/patients/patient.model.js';
import { User } from '../modules/users/user.model.js';
import { logger } from '../utils/logger.js';

/**
 * Creates missing indexes and drops ones no longer declared in the schemas.
 * Run once per deploy in production (autoIndex is off there): npm run db:indexes
 */
async function main() {
  await connectDB();
  for (const model of [User, Doctor, Patient]) {
    const dropped = await model.syncIndexes();
    const indexes = await model.listIndexes();
    logger.info(
      `${model.modelName}: ${indexes.map((i) => i.name).join(', ')}` +
        (dropped.length ? ` (dropped: ${dropped.join(', ')})` : ''),
    );
  }
  await disconnectDB();
}

main().catch(async (err) => {
  logger.error('Index sync failed', err);
  await disconnectDB();
  process.exit(1);
});
