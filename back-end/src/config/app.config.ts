import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// Read before evaluating configuration, including when imported by AuthModule.
// Existing process environment variables take precedence over the optional file.
if (existsSync('.env')) loadEnvFile('.env');

const jwtSecret =
  process.env.JWT_SECRET ??
  (process.env.NODE_ENV === 'production'
    ? undefined
    : 'urbanity-development-only-jwt-secret-change-before-production');

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in production');
}

const corsOrigins = (process.env.CORS_ORIGIN ??
  'http://localhost:3000,http://localhost:3001,http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

export const appConfig = {
  port,
  cors: {
    origin: corsOrigins,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
};
