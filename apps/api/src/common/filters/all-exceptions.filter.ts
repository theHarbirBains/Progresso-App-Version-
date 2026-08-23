import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

interface ErrorBody {
  statusCode: number;
  path: string;
  timestamp: string;
  message: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<AuthenticatedRequest>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    // Only genuine application errors (5xx) go to Sentry — a failed login
    // or a 404 is expected traffic, not something worth tracking as an
    // error. Structured logging above is unaffected either way.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.withScope((scope) => {
        scope.setTag('route', request.url);
        scope.setTag('method', request.method);
        scope.setContext('request', { requestId: request.id });
        if (request.user?.id) {
          scope.setUser({ id: request.user.id });
        }
        Sentry.captureException(exception);
      });
    }

    const body: ErrorBody = {
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message: isHttpException ? exception.getResponse() : 'Internal server error',
    };

    response.status(status).send(body);
  }
}
