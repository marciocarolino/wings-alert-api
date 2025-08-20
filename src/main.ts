import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from './app/swagger/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: ['error', 'warn', 'log', 'debug'], // opcional
  });

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger
  setupSwagger(app);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);

  Logger.log(`🚀 Wings Alerts API rodando em http://localhost:${port}`);
  const docsPath = process.env.SWAGGER_PATH || 'docs';
  if ((process.env.SWAGGER_ENABLED ?? 'true') !== 'false') {
    Logger.log(`📘 Swagger em http://localhost:${port}/${docsPath}`);
  }
}
bootstrap();
