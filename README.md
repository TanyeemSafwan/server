# Doctor Tracker — API

> **API:** https://server-kl2l.onrender.com/api/v1/health
> **Live app:** https://client-tawny-five-79.vercel.app · **Client repo:** https://github.com/TanyeemSafwan/client
>
> Demo login credentials (an admin account and a read-only viewer account) are included in the submission email.
>
> Hosted on Render's free tier: **the first request after inactivity can take 30–50 seconds** while the instance wakes up.

## Description

The REST API behind Doctor Tracker, a secure admin portal for managing doctors and their patients. It provides cookie-based JWT authentication with role-based permissions, CRUD endpoints with fast search, filtering and pagination backed by purpose-built MongoDB indexes, and aggregation-pipeline analytics for the dashboard (intake trends, patients per doctor, condition, status and specialization breakdowns). Every input is validated with Zod, and errors use one consistent JSON format.

This repository is the **standalone Express server**. The Next.js frontend lives in [TanyeemSafwan/client](https://github.com/TanyeemSafwan/client); its README also has the full system walkthrough and frontend decisions.

| Dashboard | Doctors | Mobile |
|---|---|---|
| ![Dashboard](https://github.com/TanyeemSafwan/client/blob/main/screenshots/desktop-dashboard.png) | ![Doctors](https://github.com/TanyeemSafwan/client/blob/main/screenshots/desktop-doctor.png) | ![Mobile](https://github.com/TanyeemSafwan/client/blob/main/screenshots/mobile-dashboard.png) |

More screenshots (desktop and mobile) are in the [client README](https://github.com/TanyeemSafwan/client/blob/main/README.md).

## Tech stack

Node.js 22 · **Express 5** · TypeScript (strict, ESM) · **MongoDB** with **Mongoose 9** · **Zod 4** · jsonwebtoken + bcryptjs · helmet · cors · cookie-parser · express-rate-limit · morgan · Vitest + Supertest · Faker (seed data)

## Setup guide

**Prerequisites:** Node.js 22+ and MongoDB, either local (e.g. `brew install mongodb-community`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
git clone https://github.com/TanyeemSafwan/server.git
cd server
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` / `production` |
| `PORT` | API port (default `4000`) |
| `MONGODB_URI` | e.g. `mongodb://127.0.0.1:27017/doctor-tracker` or your Atlas `mongodb+srv://…/doctor-tracker` string |
| `JWT_SECRET` | ≥ 32 random characters (`openssl rand -base64 48`); **must match the client's** |
| `JWT_EXPIRES_IN` | Session length, e.g. `8h` |
| `COOKIE_NAME` | `dt_token` (must match the client) |
| `CLIENT_ORIGIN` | The client URL, e.g. `http://localhost:3001` |
| `SEED_*` | Demo account emails and passwords created by the seed |

The app validates these at startup and exits with a clear message if any are missing or invalid.

```bash
npm run seed         # demo admin + viewer, 60 doctors, ~3,000 patients over the last 12 months
npm run dev          # http://localhost:4000  →  GET /api/v1/health
```

Then start the [client](https://github.com/TanyeemSafwan/client/blob/main/README.md) and log in with the `SEED_ADMIN_*` or `SEED_VIEWER_*` account from your `.env`.

| Script | |
|---|---|
| `npm run dev` | Watch mode (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` / run it |
| `npm test` | Vitest + Supertest suite (no database needed) |
| `npm run seed` | Reset and seed demo data (refuses in production without `-- --force`) |
| `npm run db:indexes` | Sync indexes (production runs with `autoIndex` off) |
| `npm run explain` | Print `explain()` stats for the main list queries |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |

**Deploying to Render:** root directory = this repo; build `npm ci --include=dev && npm run build` (TypeScript is a dev dependency); start `npm start`; health check `/api/v1/health`; set the env vars above. After deploying, run the seed and `db:indexes` once against the production `MONGODB_URI`.

## System architecture

```
Client (Next.js on Vercel) ──/api/* rewrite──►  Express API (Render)  ──►  MongoDB Atlas

Request pipeline:
  helmet → cors (CLIENT_ORIGIN only) → express.json (100kb) → cookie-parser → morgan
  → /api/v1 router
      → [login rate limiter]
      → authenticate        verify JWT cookie, reload user           → 401
      → authorize(perm)     role → permission check                  → 403
      → validate(zod)       parse + coerce body / query / params     → 400
      → controller          HTTP only: read req.validated, send JSON
      → service             business logic + MongoDB queries
  → notFound → errorHandler (one JSON error shape for everything)
```

**Layering:** each feature is a module (`auth`, `doctors`, `patients`, `dashboard`) with `routes → schema (zod) → controller → service → model`. Controllers never touch Mongoose; services never touch `req`/`res`.

```
src/
├── app.ts  server.ts           # app wiring / startup + graceful shutdown
├── config/                     # env (zod-validated), db, permissions
├── middleware/                 # authenticate, authorize, validate, rateLimit, errorHandler, notFound
├── modules/
│   ├── auth/  users/
│   ├── doctors/  patients/     # model, schema, service, controller, routes
│   └── dashboard/              # aggregation pipelines
├── utils/                      # AppError, pagination, search, dateRange, validation
├── constants/  types/
└── scripts/                    # seed, syncIndexes, explain
tests/                          # unit + HTTP tests
```

## API reference

Base URL `/api/v1`. All routes except `POST /auth/login`, `POST /auth/logout` and `GET /health` require the auth cookie.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/health` | public | `{ status, db }`, 503 if the DB is down |
| POST | `/auth/login` | public, rate-limited | Sets the httpOnly cookie |
| POST | `/auth/logout` | public | Clears the cookie |
| GET | `/auth/me` | signed in | Current user + permissions |
| GET | `/doctors` | `doctor:read` | `search, specialization (multi), hospital, from, to, sort=name\|createdAt\|patientCount, order, page, limit`; each row includes `patientCount` |
| GET | `/doctors/options` | `doctor:read` | Lightweight list for pickers (`?search=`) |
| GET | `/doctors/filters` | `doctor:read` | Distinct hospitals + specializations |
| POST | `/doctors` | `doctor:write` | Create |
| GET | `/doctors/:id` | `doctor:read` | Profile + patient count + status breakdown |
| PATCH | `/doctors/:id` | `doctor:write` | Partial update |
| DELETE | `/doctors/:id` | `doctor:write` | 409 while the doctor still has patients |
| GET | `/doctors/:id/patients` | `patient:read` | Same filters as `/patients` |
| POST | `/doctors/:id/patients` | `patient:write` | Add a patient under this doctor |
| GET | `/patients` | `patient:read` | `search, condition, status, gender (multi), doctor, ageMin, ageMax, from, to, sort=admissionDate\|name\|age, order, page, limit` |
| POST | `/patients` | `patient:write` | Create (doctor id in body) |
| GET / PATCH / DELETE | `/patients/:id` | read / write | Edit includes reassigning the doctor |
| GET | `/dashboard/summary` | `dashboard:read` | KPIs + change vs previous period (`from, to`; default last 30 days) |
| GET | `/dashboard/trends` | `dashboard:read` | Admissions per `day\|week\|month`, gap-filled |
| GET | `/dashboard/patients-per-doctor` | `dashboard:read` | Top N doctors in the period |
| GET | `/dashboard/distribution` | `dashboard:read` | By condition, status, gender (one `$facet` pass) + doctors by specialization |

**Responses:** `{ data }` or `{ data, meta: { page, limit, total, totalPages } }`.
**Errors:** `{ error: { code, message, details? } }`, with `details` keyed by field.

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_ID`, `INVALID_JSON` | Bad input |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | Missing / invalid / expired session |
| 403 | `FORBIDDEN` | Role lacks the permission |
| 404 | `NOT_FOUND` | Unknown resource or route |
| 409 | `CONFLICT` | Duplicate email, deleting a doctor with patients |
| 413 / 429 / 500 | `PAYLOAD_TOO_LARGE` / `RATE_LIMITED` / `INTERNAL_ERROR` | |

## Data model & indexes

| Collection | Fields |
|---|---|
| `users` | name, email (unique), passwordHash (`select: false`, bcrypt 12 rounds), role (`admin` \| `viewer`), lastLoginAt |
| `doctors` | name, specialization (enum), hospital, phone, email (unique), searchTokens, timestamps |
| `patients` | name, age, gender, phone, email?, condition (enum), status (`admitted` \| `under_treatment` \| `recovered` \| `discharged`), admissionDate, doctor (ref), notes?, searchTokens, timestamps |

Compound indexes follow the **Equality → Sort → Range** rule, one per query shape:

```js
// doctors
{ email: 1 } unique · { searchTokens: 1 } · { specialization: 1, createdAt: -1 }
{ hospital: 1, createdAt: -1 } · { createdAt: -1 } · { name: 1 }
// patients
{ doctor: 1, admissionDate: -1 }     // a doctor's patients, patient counts, per-doctor stats
{ condition: 1, admissionDate: -1 }  · { status: 1, admissionDate: -1 }
{ admissionDate: -1 }                // default sort, date ranges, trend aggregation
{ searchTokens: 1 }
```

`npm run explain` runs the real filter builders through `explain('executionStats')` and prints, for each list query, whether it used an index scan, which index, and keys/docs examined vs. returned.

Other query-level choices:
- **`.lean()`** on reads (plain objects, no Mongoose document overhead)
- **The page and the total count run in parallel** (`Promise.all`); unfiltered lists use `estimatedDocumentCount()` (an instant metadata count)
- **Patient counts per doctor** are computed with a `$lookup` + `$count` **after** pagination, so only the 10 doctors on the page are counted (unless sorting by count)
- **An `_id` tiebreaker in sorts** keeps pagination stable
- **Dashboard pipelines** all start with an indexed `$match` on the date; top doctors are grouped and limited before the `$lookup` for names; trends use `$dateTrunc` and gaps are filled server-side

## Technical decisions

### 1. Token-prefix search on a multikey index (instead of `$regex /i` or `$text`)

**Problem.** "Search doctors / patients" must feel instant and match partial words ("joh" finds "John"), on collections that could grow large, without full scans.

**Options considered.**
- **`{ name: { $regex: 'joh', $options: 'i' } }`.** Matches partial words, but an unanchored, case-insensitive regex **can't use an index efficiently**, so MongoDB scans every document.
- **A `$text` index.** Indexed, but matches whole words only (typing "joh" finds nothing until "john" is complete), and gives little control over ranking or combining with other filters.
- **Atlas Search (Lucene).** The best option at scale (fuzzy matching, typo tolerance), but it ties the app to Atlas and adds infrastructure for a demo-sized dataset.
- **Precomputed search tokens (chosen).** A `pre('validate')` hook stores `searchTokens`: the lowercase, accent-stripped words of the name, the part of the email before `@`, and (for patients) phone digit groups. A query like `"john sm"` becomes `{ searchTokens: { $all: [/^john/, /^sm/] } }`.

**Why it works.** An **anchored, case-sensitive** regex (`/^john/`) on a lowercase field becomes an index **range scan** on the multikey `{ searchTokens: 1 }` index, so it matches word prefixes anywhere in the name ("smi" finds "John Smith") without a collection scan. Input is regex-escaped (no injection or ReDoS) and limited to 5 terms. Accents are normalized, so "jose" finds "José".

**Trade-offs.** Slightly larger documents, and the tokens must be recomputed on every write. That's guaranteed because updates go through `doc.save()`, not `findOneAndUpdate`, so the hook always runs. There's no typo tolerance; Atlas Search would be the upgrade path.

### 2. Permission-based authorization with per-request user lookup

**Problem.** The spec asks for authentication *and* authorization on every route, and the system should stay easy to extend with new roles.

**Options considered.**
- **Role checks inside handlers** (`if (user.role !== 'admin')`). Simple, but scatters policy across the code; adding a role means editing many routes.
- **Trusting the role inside the JWT.** No database read, but a demoted or deleted user keeps their access until the token expires.
- **A central permission map + middleware (chosen).**

**Decision.**
- **Routes declare what they need, not who may call them:** `router.post('/', authenticate, authorize('doctor:write'), validate(...), create)`. `config/permissions.ts` maps each role to its permissions, so adding a role (e.g. `staff`) is one entry there with no route changes. `GET /auth/me` returns the user's permission list, which the client uses to hide actions the user can't perform; the server still enforces every check.
- **`authenticate` verifies the JWT (HS256 only) and reloads the user** with a single lean query by `_id` on every request, so role changes and deleted accounts take effect immediately rather than when the token expires.

**Trade-off.** One indexed primary-key lookup per request. That's negligible here, and a short-lived cache could remove it at scale.

### Security summary

httpOnly + `Secure` (in production) + `SameSite=Lax` cookie · bcrypt (12 rounds) · the same error for unknown emails and wrong passwords, with a dummy-hash comparison for unknown emails so response time doesn't reveal which accounts exist · login rate limit (5 failures per 15 min per IP + email) · helmet · CORS locked to `CLIENT_ORIGIN` · 100 kb body limit · Zod validation of every input and every env var · ObjectId validation · no stack traces in production · passwords excluded from queries by default.

## Testing

```bash
npm test
```

Vitest + Supertest against the real Express app, without a database (the only DB call on the tested paths, the user lookup in `authenticate`, is mocked):
- **Unit tests:** search tokenizing and regex escaping, inclusive date ranges, dashboard day/week bucketing, pagination meta, the `authorize` and `validate` middleware, doctor-name normalization
- **HTTP tests:** 401 (no cookie, forged token, deleted user), 403 (viewer writes), 400 (bad filters, invalid ids, malformed JSON), JSON 404s, health reporting a down database, logout clearing the cookie

## Scalability notes

- **Stateless JWT auth**, so instances can scale horizontally behind a load balancer. The login rate limiter would then move to a shared store such as Redis.
- **Cursor (keyset) pagination** on `(sortField, _id)` for very large collections, instead of `skip`.
- **A denormalized `patientCount`** on doctors (updated with `$inc` in a transaction) if sorting by patient count becomes hot.
- **Pre-aggregated daily stats** (a materialized collection or `$merge`) plus caching for the dashboard at higher volume.
- **Atlas Search** for fuzzy, typo-tolerant search.
- **The module structure** (`modules/*`) maps cleanly onto separate services if needed.

---

Built by **Tanyeem As Safwan**.
