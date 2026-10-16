import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateUserDto } from '../../data/schemas';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Rentals use INR and amounts are rounded to paise by the service. Bound values
// before they reach arithmetic backed by JavaScript's safe integer range.
const MAX_RENTAL_AMOUNT = 100000000;
export class RentalReviewDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
export class RentalReasonDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
export class AssignOwnerDto {
  @IsUUID('4') apartmentId!: string;
  @IsUUID('4') userId!: string;
}

export class CreateListingDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() availableUntil?: string;
  @ApiProperty() @IsUUID('4') apartmentId!: string;
  @ApiProperty({ enum: ['COMMUNITY'] })
  @IsIn(['COMMUNITY'])
  arrangement!: 'OWNER' | 'COMMUNITY';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  monthlyRent!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  securityDeposit!: number;
  @ApiProperty() @IsDateString() availableFrom!: string;
}
export class UpdateListingDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() availableUntil?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  monthlyRent?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  securityDeposit?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() availableFrom?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
  @ApiPropertyOptional({ enum: ['DRAFT', 'AVAILABLE', 'WITHDRAWN'] })
  @IsOptional()
  @IsIn(['DRAFT', 'AVAILABLE', 'WITHDRAWN'])
  status?: string;
}
export class RentEscalationDto {
  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED'] })
  @IsIn(['PERCENTAGE', 'FIXED'])
  method!: 'PERCENTAGE' | 'FIXED';
  @ApiProperty({ minimum: 0, maximum: MAX_RENTAL_AMOUNT })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  value!: number;
  @ApiProperty({ minimum: 1, maximum: 120 })
  @IsInt()
  @Min(1)
  @Max(120)
  intervalMonths!: number;
  @ApiProperty({ example: '2027-07-01' })
  @IsDateString()
  effectiveDate!: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxIncreases?: number;
}
export class CreateLeaseDto {
  @ApiProperty() @IsUUID('4') listingId!: string;
  @ApiProperty() @IsUUID('4') tenantId!: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiProperty({ minimum: 1, maximum: 31 })
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;
  @ApiPropertyOptional({ type: RentEscalationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RentEscalationDto)
  escalation?: RentEscalationDto;
}
export class OnboardTenantDto {
  @IsUUID('4') listingId!: string;
  @IsUUID('4') clientRequestId!: string;
  @IsOptional() @IsUUID('4') existingTenantId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateUserDto)
  account?: CreateUserDto;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsInt() @Min(1) @Max(31) dueDay!: number;
}
export class RenewalTermsDto {
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  monthlyRent!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  securityDeposit!: number;
  @ApiProperty({ minimum: 1, maximum: 31 })
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;
  @ApiPropertyOptional({ type: RentEscalationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RentEscalationDto)
  escalation?: RentEscalationDto;
}
export class RentAmendmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  monthlyRent?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_RENTAL_AMOUNT)
  securityDeposit?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;
  @ApiPropertyOptional({ type: RentEscalationDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RentEscalationDto)
  escalation?: RentEscalationDto | null;
  @ApiProperty() @IsDateString() effectiveDate!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) reason!: string;
}
export class PaymentEvidenceDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_RENTAL_AMOUNT)
  amount!: number;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  transactionReference!: string;
}
export class LifecycleDecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'DECLINED'] })
  @IsIn(['APPROVED', 'DECLINED'])
  decision!: 'APPROVED' | 'DECLINED';
}
export class AmendmentDecisionDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED'] })
  @IsIn(['ACCEPTED', 'REJECTED'])
  decision!: 'ACCEPTED' | 'REJECTED';
}
export class DepositEvidenceDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_RENTAL_AMOUNT)
  amount!: number;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  transactionReference!: string;
}
export class DepositAdjustmentDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_RENTAL_AMOUNT)
  amount!: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) reason!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionReference?: string;
}
export class PaymentDecisionDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] })
  @IsIn(['VERIFIED', 'REJECTED'])
  decision!: 'VERIFIED' | 'REJECTED';
}
export class DepositDeductionDecisionDto {
  @ApiProperty({ enum: ['ACCEPTED', 'DISPUTED'] })
  @IsIn(['ACCEPTED', 'DISPUTED'])
  decision!: 'ACCEPTED' | 'DISPUTED';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
export class DepositDisputeResolutionDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] })
  @IsIn(['VERIFIED', 'REJECTED'])
  decision!: 'VERIFIED' | 'REJECTED';
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
