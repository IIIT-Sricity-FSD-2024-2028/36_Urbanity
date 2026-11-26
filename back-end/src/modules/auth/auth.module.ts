import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { appConfig } from '../../config/app.config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CommunityModule } from '../community/community.module';
import { SubscriptionModule } from '../subscriptions/subscription.module';
import { PlatformAccessGuard, PlatformAccessService } from './platform-access.guard';

@Module({
  imports: [
    UsersModule,
    CommunityModule,
    SubscriptionModule,
    JwtModule.register({
      secret: appConfig.jwt.secret,
      signOptions: { expiresIn: appConfig.jwt.expiresIn as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PlatformAccessService, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: PlatformAccessGuard }],
})
export class AuthModule {}
