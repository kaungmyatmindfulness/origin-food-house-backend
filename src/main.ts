import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Conditionally enable CORS
  if (process.env.NODE_ENV === 'dev') {
    // No restrictions in development
    app.enableCors();
  } else {
    // Restrict CORS in non-dev environments
    app.enableCors({
      // TODO: adjust when deploy, NOTE:
      origin: 'https://your-production-domain.com', // or an array of allowed origins
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    });
  }

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Restaurant API')
    .setDescription('API documentation for the Restaurant POS system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [StandardApiResponse, StandardApiErrorDetails],
  });
  SwaggerModule.setup('api-docs', app, document, {
    jsonDocumentUrl: '/api-docs-json',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
}

void bootstrap();
