import type { CookieOptions, RequestHandler } from 'express';
import { env, isProd } from '../../config/env.js';
import { requireUser } from '../../middleware/authenticate.js';
import type { LoginBody } from './auth.schema.js';
import * as authService from './auth.service.js';

const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.validated.body as LoginBody;
  const { user, token, expiresAt } = await authService.login(email, password);

  res.cookie(env.COOKIE_NAME, token, { ...baseCookie, expires: expiresAt });
  res.json({ data: authService.toPublicUser(user) });
};

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, baseCookie);
  res.status(204).end();
};

export const me: RequestHandler = (req, res) => {
  res.json({ data: authService.toPublicUser(requireUser(req)) });
};
