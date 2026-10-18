import { Module } from '@nestjs/common';
import { FollowsModule } from '../follows/follows.module';
import { BlocksController, ReportsController } from './safety.controller';
import { SafetyService } from './safety.service';

@Module({
  imports: [FollowsModule],
  controllers: [BlocksController, ReportsController],
  providers: [SafetyService],
})
export class SafetyModule {}
