import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ErrorCode } from '../enums/error-code.enum';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] || randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorCode: string = ErrorCode.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();

      message = exceptionResponse.message || exception.message;

      if (status === HttpStatus.BAD_REQUEST) {
        errorCode = ErrorCode.VALIDATION_ERROR;
      } else if (status === HttpStatus.CONFLICT) {
        errorCode = ErrorCode.CONFLICT_ERROR;
      } else if (status === HttpStatus.NOT_FOUND) {
        errorCode = ErrorCode.NOT_FOUND;
      }

      if (exceptionResponse.errorCode) {
        errorCode = exceptionResponse.errorCode;
      }
    } else {
      console.error(`[Internal Error] RequestID: ${requestId}`, exception);
    }

    const formattedMessage = Array.isArray(message) ? message.join('. ') : message;

    response.status(status).json({
      success: false,
      statusCode: status,
      errorCode,
      message: formattedMessage,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }
}
