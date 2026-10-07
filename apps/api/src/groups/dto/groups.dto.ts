import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  // Who is working out today. They are added as the group starts; nobody can be added after it has started.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, { each: true })
  friendUsernames?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  clientIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  guestNames?: string[];
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
