import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { permissionsFor, ROLES, type Role } from '../../config/permissions.js';
import type { AuthUser } from '../../types/express.js';
import { AppError } from '../../utils/AppError.js';
import { User } from '../users/user.model.js';

const BCRYPT_ROUNDS = 12;
// Compared against when the email doesn't exist, so response time doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-dummy-password', BCRYPT_ROUNDS);

type TokenPayload = { sub: string; role: Role };

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function signToken(user: AuthUser) {
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>,
  });
  const { exp } = jwt.decode(token) as { exp: number };
  return { token, expiresAt: new Date(exp * 1000) };
}

/** Throws a 401 AppError if the token is missing, malformed, expired or tampered with. */
export function verifyToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub || !ROLES.includes(payload.role)) {
      throw new Error('Unexpected token payload');
    }
    return { sub: payload.sub, role: payload.role };
  } catch {
    throw AppError.unauthenticated('Your session has expired. Please sign in again.');
  }
}

export function toPublicUser(user: AuthUser) {
  return { ...user, permissions: permissionsFor(user.role) };
}

export async function findAuthUser(id: string): Promise<AuthUser | null> {
  const user = await User.findById(id).select('name email role').lean();
  if (!user) return null;
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email }).select('+passwordHash name email role').lean();
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  const authUser: AuthUser = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
  return { user: authUser, ...signToken(authUser) };
}
