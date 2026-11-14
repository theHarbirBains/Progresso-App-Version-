import { Module } from '@nestjs/common';
import { FollowsModule } from '../follows/follows.module';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { SharedExercisesService } from './shared-exercises.service';

@Module({
  imports: [FollowsModule],
  controllers: [ExercisesController],
  providers: [ExercisesService, SharedExercisesService],
})
export class ExercisesModule {}
