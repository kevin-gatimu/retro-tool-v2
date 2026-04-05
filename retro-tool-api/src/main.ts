import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { Config } from './config/configuration';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SocketIoAdapter } from './adapters/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Get configuration service first so CORS can use it immediately
  const configService = app.get(ConfigService<Config>);

  // Configure CORS FIRST — before any middleware or module handlers,
  // so preflight OPTIONS requests are handled before better-auth intercepts them
  const allowedOrigins = configService.get('allowedOrigins', {
    infer: true,
  }) ?? ['http://localhost:3000', 'http://localhost:8000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // Set global API prefix to match frontend expectations
  // Exclude health endpoints from the prefix so they're accessible at /health
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/live', 'health/ready'],
  });

  const localServerUrl =
    configService.get('localServerUrl', { infer: true }) ??
    'http://localhost:8000';
  const deployedServerUrl =
    configService.get('deployedServerUrl', { infer: true }) ??
    'https://retro-tool.azurewebsites.net';

  // Set up Swagger
  const config = new DocumentBuilder()
    .setTitle('Retro Tool API')
    .setDescription(
      'API documentation for the Retro Tool application (Handles authentication, retrospective board management, story estimate session management, in-app notifications, analytics reporting, and automated email workflows.)',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your session token',
      },
      'session',
    )
    .addServer(deployedServerUrl, 'Production')
    .addServer(localServerUrl, 'Local')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('organizations', 'Organization management endpoints')
    .addTag('teams', 'Team management endpoints')
    .addTag('user-preferences', 'User notification preference endpoints')
    .addTag('retros', 'Retrospective endpoints (retros, cards, templates)')
    .addTag('notifications', 'In-app notification endpoints')
    .addTag('estimates', 'Story estimate session endpoints')
    .addTag('sessions', 'Retro session management endpoints')
    .addTag('reports', 'Analytics and reporting endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());

  const port = configService.get('port', { infer: true }) ?? 8000;
  await app.listen(port);
  console.log(`Server is running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}
void bootstrap();
