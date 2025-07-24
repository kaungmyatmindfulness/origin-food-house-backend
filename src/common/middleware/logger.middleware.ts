import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') ?? '-';

    this.logger.log(`--> ${method} ${originalUrl} - ${userAgent} ${ip}`);

    response.on('finish', () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const { statusCode } = response;
      const contentLength = response.get('content-length') ?? '-';

      const message = `<-- ${method} ${originalUrl} ${statusCode} ${duration}ms - ${contentLength} bytes`;

      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}
