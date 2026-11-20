import type { RequestHandler } from 'express';
import type {
  DashboardRangeQuery,
  PatientsPerDoctorQuery,
  TrendsQuery,
} from './dashboard.schema.js';
import * as dashboardService from './dashboard.service.js';

export const summary: RequestHandler = async (req, res) => {
  const data = await dashboardService.getSummary(req.validated.query as DashboardRangeQuery);
  res.json({ data });
};

export const trends: RequestHandler = async (req, res) => {
  const data = await dashboardService.getTrends(req.validated.query as TrendsQuery);
  res.json({ data });
};

export const patientsPerDoctor: RequestHandler = async (req, res) => {
  const query = req.validated.query as PatientsPerDoctorQuery;
  res.json({ data: await dashboardService.getPatientsPerDoctor(query) });
};

export const distribution: RequestHandler = async (req, res) => {
  const data = await dashboardService.getDistribution(req.validated.query as DashboardRangeQuery);
  res.json({ data });
};
