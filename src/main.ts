import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';

import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get ConfigService from application context
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'production');
  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'https://origin-food-house.com',
  );

  if (nodeEnv === 'dev') {
    app.enableCors({
      origin: ['http://localhost:3001', 'http://localhost:3002'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    });
  } else {
    app.enableCors({
      origin: corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    });
  }

  app.use(cookieParser());
  // app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Restaurant API')
    .setDescription(
      'API documentation for the Restaurant Management & Ordering system',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .setOpenAPIVersion('3.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [StandardApiResponse, StandardApiErrorDetails],
  });
  SwaggerModule.setup('api-docs', app, document, {
    jsonDocumentUrl: '/api-docs-json',
  });

  await app.listen(3000);
}

void bootstrap();
