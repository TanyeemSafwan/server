import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { loginLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as auth from './auth.controller.js';
import { loginBody } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate({ body: loginBody }), auth.login);
// Public on purpose: clearing the cookie must work even when the token has expired.
authRouter.post('/logout', auth.logout);
authRouter.get('/me', authenticate, auth.me);
