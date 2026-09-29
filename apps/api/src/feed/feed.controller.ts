import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { GetFriendsFeedDto } from './dto/get-friends-feed.dto';
import { FeedService } from './feed.service';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('friends')
  async friends(@CurrentUser() user: AuthenticatedUser, @Query() dto: GetFriendsFeedDto) {
    return this.feedService.getFriendsFeed(user.id, dto.page);
  }
}
