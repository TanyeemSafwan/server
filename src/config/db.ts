import mongoose from 'mongoose';
import { env, isProd } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  await mongoose.connect(env.MONGODB_URI, {
    // In production indexes are created explicitly with `npm run db:indexes`.
    autoIndex: !isProd,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  logger.info(`MongoDB connected (${mongoose.connection.name})`);

  // Registered after the first successful connect so a failed startup doesn't log a "disconnect".
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
}

export function disconnectDB() {
  return mongoose.disconnect();
}

export function isDbConnected() {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
