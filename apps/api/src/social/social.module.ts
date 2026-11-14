import { Module } from '@nestjs/common';
import { FeedModule } from '../feed/feed.module';
import { FollowsModule } from '../follows/follows.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeopleService } from './people.service';
import { PeopleController, WorkoutSocialController } from './social.controller';
import { WorkoutSocialService } from './workout-social.service';

@Module({
  imports: [FollowsModule, FeedModule, NotificationsModule],
  controllers: [PeopleController, WorkoutSocialController],
  providers: [PeopleService, WorkoutSocialService],
})
export class SocialModule {}
