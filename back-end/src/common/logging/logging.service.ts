import { Inject, Injectable } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { LOG_DIRECTORY } from './logging.constants';

export interface RequestLogEntry {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
}

export interface ErrorLogEntry {
  method: string;
  path: string;
  statusCode: number;
  message: string | string[];
  userId?: string;
  exceptionName?: string;
  stack?: string;
}

@Injectable()
export class LoggingService {
  private readonly applicationLogFile: string;
  private readonly errorLogFile: string;
  private writeQueue = Promise.resolve();

  constructor(@Inject(LOG_DIRECTORY) private readonly logDirectory: string) {
    this.applicationLogFile = join(logDirectory, 'application.log');
    this.errorLogFile = join(logDirectory, 'error.log');
  }

  logRequest(entry: RequestLogEntry): void {
    const level = entry.statusCode >= 400 ? 'WARN' : 'INFO';
    const userId = entry.userId ? ` userId=${entry.userId}` : '';
    const line = `${new Date().toISOString()} ${level} ${entry.method} ${entry.path} ${entry.statusCode} ${entry.durationMs}ms${userId}\n`;

    this.append(this.applicationLogFile, line);
  }

  logError(entry: ErrorLogEntry): void {
    const userId = entry.userId ? ` userId=${entry.userId}` : '';
    const exception = entry.exceptionName
      ? ` exception=${entry.exceptionName}`
      : '';
    const stack = entry.stack
      ? ` stack=${JSON.stringify(this.sanitize(entry.stack))}`
      : '';
    const message = Array.isArray(entry.message)
      ? entry.message.join('; ')
      : entry.message;
    const line = `${new Date().toISOString()} ERROR ${entry.method} ${entry.path} ${entry.statusCode}${userId} message=${JSON.stringify(this.sanitize(message))}${exception}${stack}\n`;

    this.append(this.errorLogFile, line);
  }

  async flush(): Promise<void> {
    await this.writeQueue;
  }

  private append(file: string, line: string): void {
    this.writeQueue = this.writeQueue
      .then(async () => {
        await mkdir(this.logDirectory, { recursive: true });
        await appendFile(file, line, 'utf8');
      })
      .catch(() => undefined);
  }

  private sanitize(value: string): string {
    return value
      .replace(/(Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
      .replace(
        /((?:passwordHash|password|accessToken|token)\s*[=:]\s*)[^\s,;"']+/gi,
        '$1[REDACTED]',
      )
      .replace(/[\r\n]+/g, '\\n');
  }
}
