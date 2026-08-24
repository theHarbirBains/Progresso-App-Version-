import { Body, Controller, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { ExercisesService } from './exercises.service';

// Reads (search/list/filter) go direct to Supabase from the mobile app,
// protected by RLS -- only writes go through the backend, for centralized
// validation and clean error messages (duplicate-name conflicts, ownership
// enforcement). See CLAUDE.md's hybrid backend architecture rule.
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExerciseDto) {
    return this.exercisesService.createCustom(user.id, dto);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.exercisesService.updateCustom(user.id, id, dto);
  }
}
