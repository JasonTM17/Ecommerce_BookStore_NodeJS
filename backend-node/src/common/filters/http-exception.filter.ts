import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

const STATUS_REASONS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

/**
 * Mirrors the Spring `GlobalExceptionHandler.ErrorResponse` JSON shape so
 * frontend error handling keeps working unchanged.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let validationErrors: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const payload = body as Record<string, unknown>;
        if (Array.isArray(payload.message)) {
          // class-validator errors -> Spring's "Dữ liệu không hợp lệ" envelope
          validationErrors = {};
          for (const entry of payload.message as string[]) {
            const [field, ...rest] = entry.split(' ');
            validationErrors[field] = rest.join(' ') || entry;
          }
          message = 'Dữ liệu không hợp lệ';
        } else {
          message = (payload.message as string) || exception.message;
        }
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.originalUrl}: ${exception.message}`,
        exception.stack,
      );
    }

    if (status >= 500 && !(exception instanceof HttpException)) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const errorBody: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      status,
      error: STATUS_REASONS[status] || 'Error',
      message,
      path: request.originalUrl,
    };
    if (validationErrors) {
      errorBody.validationErrors = validationErrors;
    }

    response.status(status).json(errorBody);
  }
}
