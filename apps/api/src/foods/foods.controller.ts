import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { SearchFoodsDto } from './dto/search-foods.dto';
import { FoodsService } from './foods.service';

// Food search combines Progresso's own cached catalog with a live external
// provider call (see FoodsService) -- both are reads with no per-user data
// involved, but the external call + cache-write is real business logic
// (provider orchestration, normalization, dedup-safe upserting), so this
// goes through the backend rather than direct-to-Supabase, per CLAUDE.md's
// hybrid architecture rule. Every signed-in role can search; there's
// nothing admin-specific here.
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('search')
  async search(@Query() dto: SearchFoodsDto) {
    return this.foodsService.search(dto.query, dto.page, dto.pageSize);
  }

  // Scan Barcode's lookup step. Returns `null` (200 OK) rather than a 404
  // when the product isn't found -- a missing barcode is an expected,
  // normal outcome of scanning (Open Food Facts doesn't carry every
  // product), not an error condition, so the mobile app can render its
  // friendly "Product not found" state from a plain successful response
  // instead of having to special-case a 404 the way it treats a real
  // failure.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('barcode/:barcode')
  async getByBarcode(@CurrentUser() user: AuthenticatedUser, @Param('barcode') barcode: string) {
    if (!barcode.trim()) {
      throw new BadRequestException('barcode must not be empty');
    }
    return this.foodsService.getByBarcode(barcode, user.id);
  }
}
