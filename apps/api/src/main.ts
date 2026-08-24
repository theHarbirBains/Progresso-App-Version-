import 'reflect-metadata';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { EnvironmentVariables } from './config/env.validation';
import { initSentry } from './observability/sentry';

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  const adapter = new FastifyAdapter({
    logger: isProduction
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        },
  });

  // rawBody: true preserves request.rawBody (a Buffer) alongside normal
  // JSON parsing — needed to verify the RevenueCat webhook's HMAC
  // signature, which is computed over the exact raw bytes received.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    rawBody: true,
  });
  const configService = app.get(ConfigService<EnvironmentVariables, true>);

  // As early as possible after ConfigModule has actually resolved — see
  // initSentry's own doc comment for why this can't run any earlier.
  initSentry(
    configService.get('SENTRY_DSN', { infer: true }),
    configService.get('NODE_ENV', { infer: true }),
  );

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const corsOrigin = configService.get('CORS_ORIGIN', { infer: true });
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = configService.get('PORT', { infer: true });
  const host = configService.get('HOST', { infer: true });
  await app.listen(port, host);
}

bootstrap();
