import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Frontend error beacon (sendBeacon/fetch keepalive). Accepts and logs the
 * payload; deliberately unauthenticated and low-effort — the frontend must not
 * fail when reporting errors.
 */
@Public()
@Controller('client-errors')
export class ClientErrorsController {
  private readonly logger = new Logger('ClientError');

  @Post()
  @HttpCode(204)
  report(@Body() body: unknown): void {
    try {
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      this.logger.warn(text?.slice(0, 2000) ?? 'empty client error payload');
    } catch {
      this.logger.warn('unserializable client error payload');
    }
  }
}
