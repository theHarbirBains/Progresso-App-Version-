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

  it('attaches the authenticated user to the request on a valid token, identified strictly by JWT sub', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jwtService.verify.mockResolvedValue({ sub: 'user-123', email: 'athlete@example.com' });
    const guard = new SupabaseAuthGuard(reflector, jwtService as unknown as SupabaseJwtService);
    const { context, request } = createContext({ authorization: 'Bearer good-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-123',
      email: 'athlete@example.com',
      role: Role.USER,
    });
  });

  it('never trusts a role claim from the token itself — always the default here', async () => {
    // Even if a token payload carried a role-like claim, this guard must
    // ignore it: the only trusted source for elevated roles is the
    // admin_users table, resolved later by RolesGuard.
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jwtService.verify.mockResolvedValue({
      sub: 'user-456',
      email: 'attacker@example.com',
      app_metadata: { role: 'full_admin' },
      role: 'full_admin',
    });
    const guard = new SupabaseAuthGuard(reflector, jwtService as unknown as SupabaseJwtService);
    const { context, request } = createContext({ authorization: 'Bearer good-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user?.role).toBe(Role.USER);
  });
});
