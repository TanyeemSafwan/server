import type { RequestHandler } from 'express';
import type { IdParams } from '../../utils/validation.js';
import type { CreatePatientBody, ListPatientsQuery, UpdatePatientBody } from './patient.schema.js';
import * as patientService from './patient.service.js';

export const list: RequestHandler = async (req, res) => {
  res.json(await patientService.listPatients(req.validated.query as ListPatientsQuery));
};

export const get: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParams;
  res.json({ data: await patientService.getPatient(id) });
};

export const create: RequestHandler = async (req, res) => {
  const data = await patientService.createPatient(req.validated.body as CreatePatientBody);
  res.status(201).json({ data });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParams;
  const data = await patientService.updatePatient(id, req.validated.body as UpdatePatientBody);
  res.json({ data });
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParams;
  await patientService.deletePatient(id);
  res.status(204).end();
};
