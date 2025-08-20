import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as basicAuth from 'express-basic-auth';

export function setupSwagger(app: INestApplication) {
  const enabled = (process.env.SWAGGER_ENABLED ?? 'true') !== 'false';
  if (!enabled) return;

  const path = process.env.SWAGGER_PATH || 'docs';

  // Proteção opcional (Basic Auth) para /docs e /docs-json
  const user = process.env.SWAGGER_BASIC_USER;
  const pass = process.env.SWAGGER_BASIC_PASS;
  if (user && pass) {
    app.use(
      [`/${path}`, `/${path}-json`],
      basicAuth({
        users: { [user]: pass },
        challenge: true,
      }),
    );
  }

  const config = new DocumentBuilder()
    .setTitle(process.env.SWAGGER_TITLE || 'Wings Alerts API')
    .setDescription(process.env.SWAGGER_DESC || 'API para alertas de cripto')
    .setVersion(process.env.SWAGGER_VERSION || '0.1.0')
    .addBearerAuth() // pra quando adicionarmos JWT
    .addApiKey(
      // header opcional x-api-key (futuro)
      { type: 'apiKey', name: 'x-api-key', in: 'header' },
      'x-api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
