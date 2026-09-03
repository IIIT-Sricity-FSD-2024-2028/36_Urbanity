import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({ imports: [forwardRef(() => UsersModule)], controllers: [SubscriptionController], providers: [SubscriptionService], exports: [SubscriptionService] })
export class SubscriptionModule {}
