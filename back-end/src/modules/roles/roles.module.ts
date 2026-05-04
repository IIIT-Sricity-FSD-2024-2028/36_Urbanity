import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { rolesProviders } from './roles.service';

@Module({
  controllers: [RolesController],
  providers: rolesProviders,
})
export class RolesModule {}
