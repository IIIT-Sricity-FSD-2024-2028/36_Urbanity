import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { appConfig } from './app.config';

export const configureHttpSecurity = (app: INestApplication): void => {
  app.use(
    helmet({
      hsts: process.env.NODE_ENV === 'production' ? undefined : false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
        },
      },
    }),
  );
  app.enableCors(appConfig.cors);
};
