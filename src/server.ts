import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDB();

  const server = createApp().listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force exit if connections don't close in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
