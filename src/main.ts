import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.NODE_ENV === 'dev') {
    app.enableCors();
  } else {
    app.enableCors({
      origin: 'https://your-production-domain.com', // TODO: replace with your production domain
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    });
  }

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

  await app.listen(3000);
}

void bootstrap();
