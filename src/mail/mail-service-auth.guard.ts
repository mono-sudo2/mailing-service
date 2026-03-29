import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * When `MAIL_SERVICE_API_KEY` is set, requires either:
 * - `X-API-Key: <key>`
 * - `Authorization: Bearer <key>`
 *
 * When unset or empty, all requests are allowed (local / private network use).
 */
@Injectable()
export class MailServiceAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const key = this.config.get<string>('MAIL_SERVICE_API_KEY')?.trim();
    if (!key) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const headerKey =
      typeof req.headers['x-api-key'] === 'string'
        ? req.headers['x-api-key']
        : undefined;
    const auth = req.headers['authorization'];
    const bearer =
      typeof auth === 'string' && auth.startsWith('Bearer ')
        ? auth.slice(7)
        : undefined;

    if (headerKey === key || bearer === key) {
      return true;
    }

    throw new UnauthorizedException('Invalid or missing API key');
  }
}
