import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import type { SupabaseService } from '../../supabase/supabase.service';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './roles.guard';

function createContext(user: AuthenticatedRequest['user']): {
  context: ExecutionContext;
  request: AuthenticatedRequest;
} {
  const request = { headers: {}, user } as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let supabaseService: { getAdminRole: jest.Mock };

  beforeEach(() => {
    reflector = new Reflector();
    supabaseService = { getAdminRole: jest.fn() };
  });

  it('allows any request through when the route has no @Roles(...)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const guard = new RolesGuard(reflector, supabaseService as unknown as SupabaseService);
    const { context } = createContext(undefined);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(supabaseService.getAdminRole).not.toHaveBeenCalled();
  });

  it('rejects a normal user from an admin-only route', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.SUPPORT_ADMIN, Role.FULL_ADMIN]);
    supabaseService.getAdminRole.mockResolvedValue(null); // no admin_users row
    const guard = new RolesGuard(reflector, supabaseService as unknown as SupabaseService);
    const { context } = createContext({ id: 'user-1', role: Role.USER });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(supabaseService.getAdminRole).toHaveBeenCalledWith('user-1');
  });

  it('allows a user with a matching admin_users row through', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.SUPPORT_ADMIN, Role.FULL_ADMIN]);
    supabaseService.getAdminRole.mockResolvedValue(Role.FULL_ADMIN);
    const guard = new RolesGuard(reflector, supabaseService as unknown as SupabaseService);
    const { context, request } = createContext({ id: 'user-2', role: Role.USER });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user?.role).toBe(Role.FULL_ADMIN);
  });

  it('rejects an admin whose role does not match the required set', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.FULL_ADMIN]);
    supabaseService.getAdminRole.mockResolvedValue(Role.SUPPORT_ADMIN);
    const guard = new RolesGuard(reflector, supabaseService as unknown as SupabaseService);
    const { context } = createContext({ id: 'user-3', role: Role.USER });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
