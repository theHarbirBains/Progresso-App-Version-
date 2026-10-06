import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  // Start the group from this open workout of yours, rather than a new one.
  @IsOptional()
  @IsUUID()
  workoutId?: string;
}

export class InviteMemberDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/)
  username!: string;
}

export class AddGroupClientDto {
  @IsUUID()
  clientId!: string;
}

export class AddGuestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;
}

export class RespondGroupInviteDto {
  @IsIn(['accept', 'decline'])
  action!: 'accept' | 'decline';
}
