import { Module } from '@nestjs/common';
import { FollowsModule } from '../follows/follows.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [FollowsModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
