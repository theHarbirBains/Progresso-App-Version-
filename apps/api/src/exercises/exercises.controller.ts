import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { ExercisesService } from './exercises.service';
import { SharedExercisesService } from './shared-exercises.service';

// Reads (search/list/filter) go direct to Supabase from the mobile app,
// protected by RLS -- only writes go through the backend, for centralized
// validation and clean error messages (duplicate-name conflicts, ownership
// enforcement). See CLAUDE.md's hybrid backend architecture rule. Libraries
// shared between people (a trainer and their clients, the people you follow)
// are read here too: who shares with whom, and blocks, are server-side logic.
@Controller('exercises')
export class ExercisesController {
  constructor(
    private readonly exercisesService: ExercisesService,
    private readonly sharedExercisesService: SharedExercisesService,
  ) {}

  /** The custom exercises your trainer, your clients and the people you follow share with you. */
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('shared')
  async listShared(@CurrentUser() user: AuthenticatedUser) {
    return { exercises: await this.sharedExercisesService.list(user.id) };
  }

  /** Makes a shared exercise yours: your own by that name at that gym, or a copy in your library. */
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post(':id/copy')
  async copy(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sharedExercisesService.copy(user.id, id);
  }

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
