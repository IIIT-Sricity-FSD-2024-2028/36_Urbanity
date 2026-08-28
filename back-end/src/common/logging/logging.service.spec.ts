import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LoggingService } from './logging.service';

describe('LoggingService', () => {
  let directory: string;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('writes append-only sanitized error log entries separately from request logs', async () => {
    directory = await mkdtemp(join(tmpdir(), 'urbanity-error-logs-'));
    const logger = new LoggingService(directory);

    logger.logRequest({ method: 'GET', path: '/', statusCode: 200, durationMs: 1 });
    logger.logError({
      method: 'POST',
      path: '/auth/login',
      statusCode: 401,
      message: 'password=resident-dev Bearer secret-token',
      exceptionName: 'UnauthorizedException',
    });
    await logger.flush();

    const applicationLog = await readFile(join(directory, 'application.log'), 'utf8');
    const errorLog = await readFile(join(directory, 'error.log'), 'utf8');
    expect(applicationLog).toContain('INFO GET / 200 1ms');
    expect(errorLog).toContain('ERROR POST /auth/login 401');
    expect(errorLog).toContain('password=[REDACTED]');
    expect(errorLog).toContain('Bearer [REDACTED]');
    expect(errorLog).not.toContain('resident-dev');
    expect(errorLog).not.toContain('secret-token');
  });
});
