import { Router } from 'express';
import { isDbConnected } from '../config/db.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { doctorRouter } from '../modules/doctors/doctor.routes.js';
import { patientRouter } from '../modules/patients/patient.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  const db = isDbConnected() ? 'up' : 'down';
  res.status(db === 'up' ? 200 : 503).json({ status: db === 'up' ? 'ok' : 'degraded', db });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/doctors', doctorRouter);
apiRouter.use('/patients', patientRouter);
apiRouter.use('/dashboard', dashboardRouter);
