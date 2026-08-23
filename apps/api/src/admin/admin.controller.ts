import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

// Minimal placeholder proving the admin authorization path actually works
// end to end. The real admin API is Phase 9.
@Controller('admin')
export class AdminController {
  @Roles(Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('ping')
  ping(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, role: user.role };
  }
}
