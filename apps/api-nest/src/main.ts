import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import helmet from 'helmet';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

// Auto-load & unify environment variables from both root .env and apps/api-nest/.env
function loadUnifiedEnv() {
  const candidates = [
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '.env'),
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx > 0) {
          const key = line.slice(0, eqIdx).trim();
          const val = line.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadUnifiedEnv();

async function bootstrap() {
  const logger = new Logger('OceanVisionBootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 1. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. Strict CORS policy
  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 3. WebSocket Adapter (ws engine)
  app.useWebSocketAdapter(new WsAdapter(app));

  // 4. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 5. Global API Prefix
  app.setGlobalPrefix('api');

  // 6. OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Ocean Vision ESP32-CAM API')
    .setDescription('Enterprise Surveillance & Telemetry Backend with Zero-Client-Persistence Architecture')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
    .addApiKey({ type: 'apiKey', name: 'X-Device-Token', in: 'header' }, 'DeviceToken')
    .addApiKey({ type: 'apiKey', name: 'X-Signature', in: 'header' }, 'HMAC-Signature')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 7. Serve React Frontend static bundle (apps/web-ocean/dist) for unified cloud hosting
  const webDistPath = path.resolve(process.cwd(), '../web-ocean/dist');
  if (fs.existsSync(webDistPath)) {
    app.useStaticAssets(webDistPath);
    app.use((req: any, res: any, next: any) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
        return res.sendFile(path.join(webDistPath, 'index.html'));
      }
      next();
    });
    logger.log(`Serving unified Web UI bundle from ${webDistPath}`);
  }

  // 8. Enable Graceful Shutdown Hooks
  app.enableShutdownHooks();

  const port = process.env.PORT || 7860;
  await app.listen(port, '0.0.0.0');
  logger.log(`Ocean Vision unified server operational at http://0.0.0.0:${port}`);
  logger.log(`Swagger Interactive Documentation available at http://0.0.0.0:${port}/api/docs`);
  logger.log(`Real-time Telemetry Gateway bound at ws://0.0.0.0:${port}/ws/telemetry`);
}

bootstrap();

