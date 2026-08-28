const jwtSecret =
  process.env.JWT_SECRET ??
  (process.env.NODE_ENV === 'production'
    ? undefined
    : 'urbanity-development-only-jwt-secret-change-before-production');

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in production');
}

const corsOrigins = (process.env.CORS_ORIGIN ??
  'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  cors: {
    origin: corsOrigins,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
};
