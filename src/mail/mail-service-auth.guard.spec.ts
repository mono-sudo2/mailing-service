import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailServiceAuthGuard } from './mail-service-auth.guard';

describe('MailServiceAuthGuard', () => {
  const createContext = (headers: Record<string, string | undefined>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as ExecutionContext;

  it('allows when MAIL_SERVICE_API_KEY is unset', () => {
    const guard = new MailServiceAuthGuard({
      get: () => undefined,
    } as unknown as ConfigService);
    expect(guard.canActivate(createContext({}))).toBe(true);
  });

  it('allows when key matches X-API-Key', () => {
    const guard = new MailServiceAuthGuard({
      get: () => 'secret',
    } as unknown as ConfigService);
    expect(guard.canActivate(createContext({ 'x-api-key': 'secret' }))).toBe(
      true,
    );
  });

  it('allows when key matches Authorization Bearer', () => {
    const guard = new MailServiceAuthGuard({
      get: () => 'secret',
    } as unknown as ConfigService);
    expect(
      guard.canActivate(createContext({ authorization: 'Bearer secret' })),
    ).toBe(true);
  });

  it('throws when key is set but headers wrong', () => {
    const guard = new MailServiceAuthGuard({
      get: () => 'secret',
    } as unknown as ConfigService);
    expect(() =>
      guard.canActivate(createContext({ 'x-api-key': 'wrong' })),
    ).toThrow(UnauthorizedException);
  });
});
