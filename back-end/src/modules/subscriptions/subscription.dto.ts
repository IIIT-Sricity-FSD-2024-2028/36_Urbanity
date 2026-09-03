import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export enum SubscriptionStatus { PaymentPending = 'PAYMENT_PENDING', Active = 'ACTIVE' }
export enum PaymentStatus { Pending = 'PENDING', Success = 'SUCCESS' }

export class Subscription {
  @ApiProperty() id!: string;
  @ApiProperty() communityId!: string;
  @ApiProperty() communityName!: string;
  @ApiProperty() contractedTowers!: number;
  @ApiProperty() contractedApartments!: number;
  @ApiProperty() towerRate!: number;
  @ApiProperty() apartmentRate!: number;
  @ApiProperty() amount!: number;
  @ApiProperty({ enum: SubscriptionStatus }) status!: SubscriptionStatus;
  @ApiProperty({ enum: PaymentStatus }) paymentStatus!: PaymentStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() pendingContractedTowers?: number;
  @ApiProperty() pendingContractedApartments?: number;
  @ApiProperty() pendingUpgradeAmount?: number;
}

export class RequestUpgradeDto {
  @ApiProperty() @IsInt() @Min(1) contractedTowers!: number;
  @ApiProperty() @IsInt() @Min(1) contractedApartments!: number;
}
