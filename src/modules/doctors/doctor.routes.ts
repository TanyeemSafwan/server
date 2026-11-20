import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/validation.js';
import { createPatientForDoctorBody, listDoctorPatientsQuery } from '../patients/patient.schema.js';
import * as doctors from './doctor.controller.js';
import {
  createDoctorBody,
  doctorOptionsQuery,
  listDoctorsQuery,
  updateDoctorBody,
} from './doctor.schema.js';

export const doctorRouter = Router();

doctorRouter.use(authenticate);

const canRead = authorize('doctor:read');
const canWrite = authorize('doctor:write');

// Static paths before `/:id` so they aren't treated as ids.
doctorRouter.get('/options', canRead, validate({ query: doctorOptionsQuery }), doctors.options);
doctorRouter.get('/filters', canRead, doctors.filters);

doctorRouter.get('/', canRead, validate({ query: listDoctorsQuery }), doctors.list);
doctorRouter.post('/', canWrite, validate({ body: createDoctorBody }), doctors.create);
doctorRouter.get('/:id', canRead, validate({ params: idParams }), doctors.get);
doctorRouter.patch(
  '/:id',
  canWrite,
  validate({ params: idParams, body: updateDoctorBody }),
  doctors.update,
);
doctorRouter.delete('/:id', canWrite, validate({ params: idParams }), doctors.remove);

doctorRouter.get(
  '/:id/patients',
  authorize('patient:read'),
  validate({ params: idParams, query: listDoctorPatientsQuery }),
  doctors.listPatients,
);
doctorRouter.post(
  '/:id/patients',
  authorize('patient:write'),
  validate({ params: idParams, body: createPatientForDoctorBody }),
  doctors.createPatient,
);
