import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { authorize } from '../src/middleware/authorize.js';
import { validate } from '../src/middleware/validate.js';
import { listPatientsQuery } from '../src/modules/patients/patient.schema.js';
import type { AppError } from '../src/utils/AppError.js';

/** Runs a middleware and resolves with the error it passed to next() (or undefined). */
function run(middleware: (req: Request, res: Response, next: NextFunction) => void, req: object) {
  return new Promise<AppError | undefined>((resolve) =>
    middleware(req as Request, {} as Response, (err?: unknown) => resolve(err as AppError)),
  );
}

describe('authorize()', () => {
  it('lets an admin write', async () => {
    expect(await run(authorize('doctor:write'), { user: { role: 'admin' } })).toBeUndefined();
  });

  it('lets a viewer read but not write', async () => {
    expect(await run(authorize('doctor:read'), { user: { role: 'viewer' } })).toBeUndefined();
    expect((await run(authorize('doctor:write'), { user: { role: 'viewer' } }))?.status).toBe(403);
  });

  it('rejects requests without a user as 401', async () => {
    expect((await run(authorize('doctor:read'), {}))?.status).toBe(401);
  });
});

describe('validate()', () => {
  const middleware = validate({
    body: z.object({ email: z.email() }),
    query: listPatientsQuery,
  });

  it('coerces and stores valid input on req.validated', async () => {
    const req = { body: { email: 'a@b.co' }, query: { page: '3', condition: 'Flu,Asthma' } } as {
      validated?: { query?: { page: number; condition: string[] } };
    } & object;
    expect(await run(middleware, req)).toBeUndefined();
    expect(req.validated?.query).toMatchObject({
      page: 3,
      limit: 10,
      condition: ['Flu', 'Asthma'],
    });
  });

  it('returns 400 with per-field details for bad input', async () => {
    const err = await run(middleware, {
      body: { email: 'nope' },
      query: { ageMin: 'abc', sort: 'password' },
    });
    expect(err?.status).toBe(400);
    expect(err?.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(err?.details ?? {}).sort()).toEqual(['ageMin', 'email', 'sort']);
  });

  it('rejects page sizes above the cap', async () => {
    const err = await run(validate({ query: listPatientsQuery }), { query: { limit: '500' } });
    expect(err?.details).toHaveProperty('limit');
  });
});

describe('doctor name normalization', async () => {
  const { createDoctorBody } = await import('../src/modules/doctors/doctor.schema.js');
  const base = {
    specialization: 'Cardiology',
    hospital: 'City',
    phone: '+1 555 000 1111',
    email: 'a@b.co',
  };

  it('drops a typed "Dr." prefix so the UI never shows "Dr. Dr."', () => {
    expect(createDoctorBody.parse({ ...base, name: 'Dr. Jane Smith' }).name).toBe('Jane Smith');
    expect(createDoctorBody.parse({ ...base, name: 'dr jane smith' }).name).toBe('jane smith');
    expect(createDoctorBody.parse({ ...base, name: 'Drake Bell' }).name).toBe('Drake Bell');
  });
});
