import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl: url } = request;
    const userAgent = request.get('user-agent') || '';

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');

      this.logger.verbose(`Request Body: ${JSON.stringify(request.body)}`);

      this.logger.log(
        `${method} ${url} ${statusCode} ${contentLength || '-'} - ${userAgent} ${ip}`,
      );
    });

    next();
  }
}
