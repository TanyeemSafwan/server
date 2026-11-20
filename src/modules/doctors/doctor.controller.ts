import type { RequestHandler } from 'express';
import type { IdParams } from '../../utils/validation.js';
import type { CreatePatientForDoctorBody, ListPatientsQuery } from '../patients/patient.schema.js';
import * as patientService from '../patients/patient.service.js';
import type {
  CreateDoctorBody,
  DoctorOptionsQuery,
  ListDoctorsQuery,
  UpdateDoctorBody,
} from './doctor.schema.js';
import * as doctorService from './doctor.service.js';

export const list: RequestHandler = async (req, res) => {
  res.json(await doctorService.listDoctors(req.validated.query as ListDoctorsQuery));
};

export const options: RequestHandler = async (req, res) => {
  const data = await doctorService.listDoctorOptions(req.validated.query as DoctorOptionsQuery);
  res.json({ data });
};

export const filters: RequestHandler = async (_req, res) => {
  res.json({ data: await doctorService.getDoctorFilterOptions() });
};

export const get: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParams;
  res.json({ data: await doctorService.getDoctor(id) });
};

export const create: RequestHandler = async (req, res) => {
  const data = await doctorService.createDoctor(req.validated.body as CreateDoctorBody);
  res.status(201).json({ data });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParams;
  const data = await doctorService.updateDoctor(id, req.validated.body as UpdateDoctorBody);
  res.json({ data });
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParams;
  await doctorService.deleteDoctor(id);
  res.status(204).end();
};

export const listPatients: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParams;
  const query = req.validated.query as Omit<ListPatientsQuery, 'doctor'>;
  await doctorService.assertDoctorExists(id);
  res.json(await patientService.listPatients({ ...query, doctor: id }));
};

export const createPatient: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParams;
  const body = req.validated.body as CreatePatientForDoctorBody;
  const data = await patientService.createPatient({ ...body, doctor: id });
  res.status(201).json({ data });
};
