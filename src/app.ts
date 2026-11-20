import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  // Behind Render's / Vercel's proxy: trust the first hop so req.ip and secure cookies work.
  if (isProd) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(morgan(isProd ? 'combined' : 'dev'));

  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
