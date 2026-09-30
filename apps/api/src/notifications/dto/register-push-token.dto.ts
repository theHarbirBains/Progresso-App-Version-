import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const PUSH_TOKEN_PLATFORMS = ['ios', 'android'] as const;
export type PushTokenPlatform = (typeof PUSH_TOKEN_PLATFORMS)[number];

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  expoPushToken!: string;

  @IsIn(PUSH_TOKEN_PLATFORMS)
  platform!: PushTokenPlatform;
}
