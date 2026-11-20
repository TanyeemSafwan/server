import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as dashboard from './dashboard.controller.js';
import { dashboardRangeQuery, patientsPerDoctorQuery, trendsQuery } from './dashboard.schema.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, authorize('dashboard:read'));

dashboardRouter.get('/summary', validate({ query: dashboardRangeQuery }), dashboard.summary);
dashboardRouter.get('/trends', validate({ query: trendsQuery }), dashboard.trends);
dashboardRouter.get(
  '/patients-per-doctor',
  validate({ query: patientsPerDoctorQuery }),
  dashboard.patientsPerDoctor,
);
dashboardRouter.get(
  '/distribution',
  validate({ query: dashboardRangeQuery }),
  dashboard.distribution,
);
