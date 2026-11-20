import { z } from 'zod';
import { email } from '../../utils/validation.js';

export const loginBody = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(200),
});

export type LoginBody = z.infer<typeof loginBody>;
