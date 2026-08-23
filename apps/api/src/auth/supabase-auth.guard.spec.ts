import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../common/enums/role.enum';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import type { SupabaseJwtService } from './supabase-jwt.service';
import type { AuthenticatedRequest } from './types/authenticated-request';

function createContext(headers: Record<string, string>): {
  context: ExecutionContext;
  request: AuthenticatedRequest;
} {
  const request = { headers, user: undefined } as unknown as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('SupabaseAuthGuard', () => {
  let jwtService: { verify: jest.Mock };
  let reflector: Reflector;

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    reflector = new Reflector();
  });

  it('allows public routes without a token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const guard = new SupabaseAuthGuard(reflector, jwtService as unknown as SupabaseJwtService);
    const { context } = createContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a request with no bearer token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const guard = new SupabaseAuthGuard(reflector, jwtService as unknown as SupabaseJwtService);
    const { context } = createContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid or expired token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jwtService.verify.mockRejectedValue(new Error('signature verification failed'));
    const guard = new SupabaseAuthGuard(reflector, jwtService as unknown as SupabaseJwtService);
    const { context } = createContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the authenticated user to the request on a valid token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jwtService.verify.mockResolvedValue({
      sub: 'user-123',
      email: 'athlete@example.com',
      app_metadata: { role: Role.SUPPORT_ADMIN },
    });
    const guard = new SupabaseAuthGuard(reflector, jwtService as unknown as SupabaseJwtService);
    const { context, request } = createContext({ authorization: 'Bearer good-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-123',
      email: 'athlete@example.com',
      role: Role.SUPPORT_ADMIN,
    });
  });

  it('defaults to the user role when no role claim is present', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jwtService.verify.mockResolvedValue({ sub: 'user-456' });
    const guard = new SupabaseAuthGuard(reflector, jwtService as unknown as SupabaseJwtService);
    const { context, request } = createContext({ authorization: 'Bearer good-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user?.role).toBe(Role.USER);
  });
});
