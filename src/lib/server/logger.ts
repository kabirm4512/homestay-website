/** Structured JSON logs (picked up by Vercel / any log drain). Never log secrets or ID numbers. */
type Level = 'info' | 'warn' | 'error';

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
  error: (event: string, err: unknown, fields?: Record<string, unknown>) =>
    write('error', event, {
      ...fields,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 5).join('\n') } : String(err),
    }),
};
