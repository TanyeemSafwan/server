type Meta = Record<string, unknown> | unknown;

function write(level: 'info' | 'warn' | 'error', message: string, meta?: Meta) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  if (meta === undefined) console[level](line);
  else console[level](line, meta);
}

export const logger = {
  info: (message: string, meta?: Meta) => write('info', message, meta),
  warn: (message: string, meta?: Meta) => write('warn', message, meta),
  error: (message: string, meta?: Meta) => write('error', message, meta),
};
