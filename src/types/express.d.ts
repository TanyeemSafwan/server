import type { Role } from '../config/permissions.js';

/** The authenticated user, attached by the `authenticate` middleware. */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      /** Set by the `validate` middleware. */
      validated: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      /** Set by the `authenticate` middleware. */
      user?: AuthUser;
    }
  }
}
