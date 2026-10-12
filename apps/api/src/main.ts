import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';

export function configureApp(app: NestExpressApplication) {
  const config = app.get(AppConfig);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: config.corsOrigins.length ? config.corsOrigins : true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useBodyParser('json', { limit: '2mb' });
  if (config.storage.driver === 'local') {
    app.useStaticAssets(resolve(config.storage.localDir), { prefix: '/uploads', maxAge: '7d' });
  }
  return config;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = configureApp(app);

  const swagger = new DocumentBuilder()
    .setTitle('PersonalPro API')
    .setDescription('API REST da plataforma para personal trainers e alunos')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), {
    jsonDocumentUrl: 'docs/openapi.json',
  });

  app.enableShutdownHooks();
  await app.listen(config.port);
  Logger.log(`API em http://localhost:${config.port} — documentação em /docs`, 'Bootstrap');
}

if (require.main === module) void bootstrap();
