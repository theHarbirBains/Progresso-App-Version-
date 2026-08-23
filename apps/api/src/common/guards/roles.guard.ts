import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { SupabaseService } from '../../supabase/supabase.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

/**
 * Enforces @Roles(...) on top of the user already attached by
 * SupabaseAuthGuard. Only activates on routes carrying @Roles(...), so the
 * common case (an authenticated route with no role restriction) never pays
 * for a database lookup — this one does exactly one, against admin_users,
 * the only trusted source for elevated permissions.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const role = (await this.supabaseService.getAdminRole(request.user.id)) ?? Role.USER;
    request.user.role = role;

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
