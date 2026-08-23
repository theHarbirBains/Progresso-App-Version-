import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedRequest, AuthenticatedUser } from './types/authenticated-request';
import { SupabaseJwtService } from './supabase-jwt.service';

/**
 * Global guard: every route requires a valid Supabase JWT unless marked @Public().
 * Registered as APP_GUARD in AppModule so authentication is opt-out, not opt-in.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseJwtService: SupabaseJwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload;
    try {
      payload = await this.supabaseJwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Role always starts as the default here — never trust a JWT claim for
    // it. RolesGuard resolves the real role from admin_users (the only
    // trusted source, writable exclusively by service-role) when a route
    // actually requires one.
    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      role: Role.USER,
    };
    request.user = user;

    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}
