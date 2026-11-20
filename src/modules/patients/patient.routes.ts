import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/validation.js';
import * as patients from './patient.controller.js';
import { createPatientBody, listPatientsQuery, updatePatientBody } from './patient.schema.js';

export const patientRouter = Router();

patientRouter.use(authenticate);

const canRead = authorize('patient:read');
const canWrite = authorize('patient:write');

patientRouter.get('/', canRead, validate({ query: listPatientsQuery }), patients.list);
patientRouter.post('/', canWrite, validate({ body: createPatientBody }), patients.create);
patientRouter.get('/:id', canRead, validate({ params: idParams }), patients.get);
patientRouter.patch(
  '/:id',
  canWrite,
  validate({ params: idParams, body: updatePatientBody }),
  patients.update,
);
patientRouter.delete('/:id', canWrite, validate({ params: idParams }), patients.remove);
