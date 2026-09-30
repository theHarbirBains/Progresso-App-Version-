import { IsString, MaxLength, MinLength } from 'class-validator';

export class UnregisterPushTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  expoPushToken!: string;
}
