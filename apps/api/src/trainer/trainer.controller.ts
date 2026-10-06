import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AddClientDto } from './dto/add-client.dto';
import { ClaimHistoryDto } from './dto/claim-history.dto';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { RespondTrainerRequestDto } from './dto/respond-trainer-request.dto';
import { TrackClientDto } from './dto/track-client.dto';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
import { TrainerService } from './trainer.service';

// Trainer mode (workouts only). Writes go through the backend, which checks
// the Trainer entitlement and the active client link before acting. Reads of a
// client's workouts and PRs go direct to Supabase, protected by the trainer
// RLS policies (see the trainer_mode migration).
@Controller('trainer')
export class TrainerController {
  constructor(private readonly trainerService: TrainerService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('status')
  async status(@CurrentUser() user: AuthenticatedUser) {
    return this.trainerService.getStatus(user.id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('clients')
  async clients(@CurrentUser() user: AuthenticatedUser) {
    return this.trainerService.listClients(user.id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('clients')
  async addClient(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddClientDto) {
    return this.trainerService.addClient(user.id, dto);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Patch('clients/:clientId')
  async updateClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: UpdateClientProfileDto,
  ) {
    await this.trainerService.updateManagedProfile(user.id, clientId, dto);
    return { ok: true };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('clients/:clientId/end')
  async endClientLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    await this.trainerService.endLink(user.id, user.id, clientId);
    return { ok: true };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('clients/:clientId/workouts')
  async logWorkout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: LogWorkoutDto,
  ) {
    return this.trainerService.logWorkout(user.id, clientId, dto);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('requests')
  async requests(@CurrentUser() user: AuthenticatedUser) {
    return this.trainerService.listRequests(user.id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('trainers')
  async myTrainers(@CurrentUser() user: AuthenticatedUser) {
    return this.trainerService.listMyTrainers(user.id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Patch('requests/:trainerId')
  async respondToRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('trainerId', ParseUUIDPipe) trainerId: string,
    @Body() dto: RespondTrainerRequestDto,
  ) {
    await this.trainerService.respondToRequest(user.id, trainerId, dto.action);
    return { ok: true };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('links/:trainerId/end')
  async endTrainerLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('trainerId', ParseUUIDPipe) trainerId: string,
  ) {
    await this.trainerService.endLink(user.id, trainerId, user.id);
    return { ok: true };
  }

  // A client the trainer tracks with no account. The response carries the claim
  // code, which the trainer gives the client. It is not shown again.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('tracked-clients')
  async trackClient(@CurrentUser() user: AuthenticatedUser, @Body() dto: TrackClientDto) {
    return this.trainerService.trackClient(user.id, dto);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('clients/:clientId/claim-code')
  async regenerateClaimCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.trainerService.regenerateClaimCode(user.id, clientId);
  }

  // The client enters the code their trainer gave them. Their tracked history moves
  // onto their own account.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('history/claim')
  async claimHistory(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClaimHistoryDto) {
    return this.trainerService.claimHistory(user.id, dto.code);
  }

  // Attaches invites sent to this person's (confirmed) email. The app calls it at sign-in.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('invites/claim')
  async claimInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.trainerService.claimInvites(user.id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('actions')
  async actions(@CurrentUser() user: AuthenticatedUser) {
    return this.trainerService.listActions(user.id);
  }
}
