import { Module } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { WelcomeEmailService } from './welcome-email.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AccountDeletionService, WelcomeEmailService],
})
export class UsersModule {}
