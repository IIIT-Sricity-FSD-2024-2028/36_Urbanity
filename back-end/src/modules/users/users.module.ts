import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { usersProviders } from './users.service';

@Module({
  controllers: [UsersController],
  providers: usersProviders,
  exports: usersProviders,
})
export class UsersModule {}
