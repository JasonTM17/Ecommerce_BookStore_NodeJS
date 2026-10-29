import { HttpException, HttpStatus } from '@nestjs/common';

export class BadRequestException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class ConflictException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, field: string, value: unknown) {
    super(`${resource} not found with ${field}: ${value}`, HttpStatus.NOT_FOUND);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = 'Email hoặc mật khẩu không chính xác') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}
