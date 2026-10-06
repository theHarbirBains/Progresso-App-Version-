import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  // Your own workout in the group is this day of your split. Any day is allowed.
  @IsOptional()
  @IsUUID()
  splitDayId?: string;

  // Your own workout in the group, outside your split, by name.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  workoutName?: string;

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

// Which day of your split this group workout is. null clears it.
export class SetMyWorkoutDayDto {
  @IsOptional()
  @IsUUID()
  splitDayId?: string | null;
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
