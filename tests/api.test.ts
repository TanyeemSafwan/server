import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../src/types/express.js';

/**
 * HTTP-level tests against the real Express app (routing, middleware order, error format).
 * The only DB call on these paths, loading the user in `authenticate`, is mocked.
 */
const users: Record<string, AuthUser> = {
  'admin-id': { id: 'admin-id', name: 'Admin', email: 'admin@x.dev', role: 'admin' },
  'viewer-id': { id: 'viewer-id', name: 'Viewer', email: 'viewer@x.dev', role: 'viewer' },
};

vi.mock('../src/modules/auth/auth.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/modules/auth/auth.service.js')>();
  return { ...actual, findAuthUser: vi.fn(async (id: string) => users[id] ?? null) };
});

const { createApp } = await import('../src/app.js');
const app = createApp();

const cookieFor = (userId: string, role: string, secret = process.env.JWT_SECRET!) =>
  `dt_token=${jwt.sign({ role }, secret, { subject: userId, expiresIn: '1h' })}`;

let adminCookie: string;
let viewerCookie: string;

beforeAll(() => {
  adminCookie = cookieFor('admin-id', 'admin');
  viewerCookie = cookieFor('viewer-id', 'viewer');
});

describe('authentication', () => {
  it('rejects protected routes without a cookie (401)', async () => {
    const res = await request(app).get('/api/v1/doctors');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a token signed with another secret (401)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookieFor('admin-id', 'admin', 'x'.repeat(40)));
    expect(res.status).toBe(401);
  });

  it('rejects a token for a user that no longer exists (401)', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookieFor('gone', 'admin'));
    expect(res.status).toBe(401);
  });

  it('returns the current user with permissions', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', viewerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      role: 'viewer',
      permissions: ['dashboard:read', 'doctor:read', 'patient:read'],
    });
  });

  it('validates the login body before touching the database (400)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('password');
  });

  it('logout clears the cookie, even without a session', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie']?.[0]).toMatch(/dt_token=;.*Expires=Thu, 01 Jan 1970/);
  });
});

describe('authorization', () => {
  const newDoctor = {
    name: 'Test Doc',
    specialization: 'Cardiology',
    hospital: 'City General Hospital',
    phone: '+1 555 000 1111',
    email: 'test.doc@x.dev',
  };

  it('forbids viewers from creating doctors (403)', async () => {
    const res = await request(app)
      .post('/api/v1/doctors')
      .set('Cookie', viewerCookie)
      .send(newDoctor);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('forbids viewers from deleting patients (403)', async () => {
    const res = await request(app)
      .delete('/api/v1/patients/6afed118620bc7f4226bb151')
      .set('Cookie', viewerCookie);
    expect(res.status).toBe(403);
  });
});

describe('validation & errors', () => {
  it('rejects invalid list filters with per-field details (400)', async () => {
    const res = await request(app)
      .get('/api/v1/patients?ageMin=abc&sort=password&limit=500')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['ageMin', 'limit', 'sort']);
  });

  it('rejects malformed ids (400)', async () => {
    const res = await request(app).get('/api/v1/doctors/123').set('Cookie', adminCookie);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('id');
  });

  it('rejects malformed JSON bodies (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns JSON 404s for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('reports the database as down in /health when not connected (503)', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
  });
});
