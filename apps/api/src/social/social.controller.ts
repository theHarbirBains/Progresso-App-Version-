import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  CreateCommentDto,
  MatchContactsDto,
  PersonWorkoutsDto,
  SocialSummaryDto,
} from './dto/social.dto';
import { PeopleService } from './people.service';
import { WorkoutSocialService } from './workout-social.service';

// Every id in a path is checked to be a UUID before anything reads it -- they go into filter
// strings (relationship.ts).

/** Other people: their profiles, who follows them, and finding friends from contacts. */
@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('contacts')
  @HttpCode(200)
  async matchContacts(@CurrentUser() user: AuthenticatedUser, @Body() dto: MatchContactsDto) {
    return this.peopleService.matchContacts(user.id, dto.hashes);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get(':personId')
  async profile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('personId', ParseUUIDPipe) personId: string,
  ) {
    return this.peopleService.getProfile(user.id, personId);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get(':personId/workouts')
  async workouts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Query() dto: PersonWorkoutsDto,
  ) {
    return this.peopleService.getWorkouts(user.id, personId, dto.page);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get(':personId/followers')
  async followers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('personId', ParseUUIDPipe) personId: string,
  ) {
    return this.peopleService.listFollowers(user.id, personId);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get(':personId/following')
  async following(
    @CurrentUser() user: AuthenticatedUser,
    @Param('personId', ParseUUIDPipe) personId: string,
  ) {
    return this.peopleService.listFollowing(user.id, personId);
  }
}

/** A finished workout for someone else to read, and its likes and comments. */
@Controller('workouts')
export class WorkoutSocialController {
  constructor(private readonly workoutSocialService: WorkoutSocialService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('social-summary')
  @HttpCode(200)
  async summary(@CurrentUser() user: AuthenticatedUser, @Body() dto: SocialSummaryDto) {
    return this.workoutSocialService.summarize(user.id, dto.workoutIds);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Delete('comments/:commentId')
  @HttpCode(204)
  async deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    await this.workoutSocialService.deleteComment(user.id, commentId);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get(':workoutId')
  async workout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ) {
    return this.workoutSocialService.getWorkout(user.id, workoutId);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get(':workoutId/social')
  async social(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ) {
    return this.workoutSocialService.getSocial(user.id, workoutId);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Put(':workoutId/like')
  @HttpCode(204)
  async like(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ) {
    await this.workoutSocialService.like(user.id, workoutId);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Delete(':workoutId/like')
  @HttpCode(204)
  async unlike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ) {
    await this.workoutSocialService.unlike(user.id, workoutId);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post(':workoutId/comments')
  async comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.workoutSocialService.comment(user.id, workoutId, dto.body);
  }
}
