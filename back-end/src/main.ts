import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'fs';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { swaggerConfig } from './config/swagger.config';
import { validationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(appConfig.cors);
  app.useGlobalPipes(validationPipe);

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/swagger.json', JSON.stringify(document, null, 2));

  await app.listen(appConfig.port);
}
void bootstrap();
