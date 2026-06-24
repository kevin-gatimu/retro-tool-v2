import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Express } from 'express';
import { Config } from './config/configuration';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SocketIoAdapter } from './adapters/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Trust the reverse proxy (Azure App Service = one hop) so Express populates
  // req.ips from X-Forwarded-For. The throttler's proxy-aware tracker and
  // Better Auth's forwarded-IP handling both depend on this; without it req.ips
  // is empty and per-IP limits silently key off the proxy's socket address.
  const expressInstance = app.getHttpAdapter().getInstance() as Express;
  expressInstance.set('trust proxy', 1);

  // Better Auth reads the client IP only from the configured forwarded headers
  // (x-forwarded-for, …). Direct/non-proxied requests (local dev) have none, so
  // the session's ipAddress would be null. Backfill x-forwarded-for from the
  // resolved socket IP when no forwarded header is present — this never
  // overrides a real proxy header, so production behavior is unchanged.
  app.use(
    (
      req: {
        headers: Record<string, string | string[] | undefined>;
        ip?: string;
      },
      _res: unknown,
      next: () => void,
    ) => {
      if (!req.headers['x-forwarded-for'] && req.ip) {
        req.headers['x-forwarded-for'] = req.ip;
      }
      next();
    },
  );

  // Security response headers (must run before other middleware so it covers
  // every response). CSP is relaxed enough for Swagger UI's inline assets.
  app.use(
    helmet({
      // Swagger UI ships inline scripts/styles and data-URI images.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          scriptSrc: [`'self'`, `'unsafe-inline'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'https:'],
          connectSrc: [`'self'`],
        },
      },
      // Avoid blocking cross-origin asset/resource loads (Swagger, etc.).
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Get configuration service first so CORS can use it immediately
  const configService = app.get(ConfigService<Config>);

  // Redirect OAuth errors that Better Auth sends to the API root back to the frontend.
  // This happens when the OAuth state cookie is lost (e.g. cross-site ITP) and
  // Better Auth cannot read the original callbackURL from the state.
  app.use(
    (
      req: { path: string; query: Record<string, string> },
      res: { redirect: (url: string) => void },
      next: () => void,
    ) => {
      if (req.path === '/' && typeof req.query.error === 'string') {
        const frontendUrl =
          configService.get('frontend.url', { infer: true }) ||
          'http://localhost:5173';
        res.redirect(
          `${frontendUrl}/auth/sign-in?error=${encodeURIComponent(req.query.error)}`,
        );
        return;
      }
      next();
    },
  );

  // Configure CORS FIRST — before any middleware or module handlers,
  // so preflight OPTIONS requests are handled before better-auth intercepts them
  const nodeEnv = configService.get('nodeEnv', { infer: true });
  const allowedOrigins = (
    configService.get('allowedOrigins', { infer: true }) ?? []
  ).filter((origin): origin is string => Boolean(origin));

  // Fail fast in production rather than booting with an empty/undefined origin
  // list (which would silently block the UI or, worse, allow nothing safely).
  if (nodeEnv === 'production' && allowedOrigins.length === 0) {
    throw new Error(
      'No CORS origins resolved in production. Set ALLOWED_ORIGINS (or FRONTEND_URL).',
    );
  }

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

  const localServerUrl = configService.get('localServerUrl', { infer: true })!;
  const deployedServerUrl = configService.get('deployedServerUrl', {
    infer: true,
  })!;

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
