import { Module } from '@nestjs/common';
import { EquipmentProfilesController } from './equipment-profiles.controller';
import { EquipmentProfilesService } from './equipment-profiles.service';

@Module({
  controllers: [EquipmentProfilesController],
  providers: [EquipmentProfilesService],
})
export class EquipmentProfilesModule {}
