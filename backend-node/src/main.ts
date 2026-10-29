import 'reflect-metadata';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { config } from './config/configuration';

/**
 * Vercel detects this file (src/main.ts) as the NestJS entrypoint and runs the
 * whole app as one Function on Fluid compute. The app instance is therefore
 * created lazily once per warm instance and shared by both entry models:
 *
 * - Local/serverful (`node dist/main.js`, `nest start`): bootstrap() below
 *   calls app.listen(config.port) — unchanged from before.
 * - Function invocations: the default-exported request handler initializes the
 *   cached app once and reuses the Express instance for every later request.
 */
let appPromise: Promise<NestExpressApplication> | null = null;

export function getApp(): Promise<NestExpressApplication> {
  if (!appPromise) {
    appPromise = createApp().catch((error) => {
      appPromise = null;
      throw error;
    });
  }
  return appPromise;
}

async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const messages: Record<string, string> = {};
        const collect = (errs: typeof errors, prefix = '') => {
          for (const err of errs) {
            const field = prefix ? `${prefix}.${err.property}` : err.property;
            if (err.constraints) {
              messages[field] = Object.values(err.constraints)[0];
            }
            if (err.children?.length) collect(err.children, field);
          }
        };
        collect(errors);
        return new BadRequestException({
          message: 'Validation failed',
          errors: messages,
        });
      },
    }),
  );

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Serve uploaded files under /api/uploads/** (mirrors Spring resource handler).
  // Local-disk uploads are dev-only; STORAGE_DRIVER=supabase serves the same
  // /api/contracts with Supabase object URLs in hosted environments.
  app.useStaticAssets(join(process.cwd(), config.upload.dir), {
    prefix: '/api/uploads/',
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('BookStore API')
    .setDescription('BookStore REST API - Node.js (NestJS + TypeORM)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Spring exposes Swagger UI at /api/swagger-ui.html; mirror it and keep a
  // canonical /api/docs alias.
  for (const path of ['api/swagger-ui.html', 'api/docs']) {
    SwaggerModule.setup(path, app, document, { useGlobalPrefix: false });
  }

  return app;
}

type HttpRequestHandler = (req: unknown, res: unknown) => void;

let cachedHandler: HttpRequestHandler | null = null;

/** Initializes the app once per cold start and returns the request handler. */
export async function getHttpHandler(): Promise<HttpRequestHandler> {
  if (!cachedHandler) {
    const app = await getApp();
    await app.init();
    cachedHandler = app.getHttpAdapter().getInstance() as HttpRequestHandler;
  }
  return cachedHandler;
}

export default async function handler(req: unknown, res: unknown): Promise<void> {
  const dispatch = await getHttpHandler();
  dispatch(req, res);
}

async function bootstrap(): Promise<void> {
  const app = await getApp();
  await app.listen(config.port, '0.0.0.0');
}

// Listen only when executed directly — not when imported as a function module.
if (require.main === module) {
  void bootstrap();
}
