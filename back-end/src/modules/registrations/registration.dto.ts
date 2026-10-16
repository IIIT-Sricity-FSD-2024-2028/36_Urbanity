import { Transform } from 'class-transformer';
import {
  Equals,
  IsDivisibleBy,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class SizeDto {
  @IsInt() @Min(1) @Max(10000) towers!: number;
  @IsInt() @Min(1) @Max(1000000) apartments!: number;
}
export class ApplicationDto extends SizeDto {
  @IsUUID('4') requestId!: string;
  @IsInt() @Min(1) pricingVersion!: number;
  @Trim() @IsString() @MinLength(2) @MaxLength(100) fullName!: string;
  @Trim() @IsEmail() @MaxLength(100) email!: string;
  @IsOptional()
  @Trim()
  @Matches(/^(?=(?:\D*\d){7,15}\D*$)\+?[0-9 ()-]{7,20}$/)
  phone?: string;
  @Trim() @IsString() @MinLength(2) @MaxLength(120) communityName!: string;
  @IsOptional() @Trim() @IsString() @MaxLength(500) description?: string;
  @Trim() @IsString() @MinLength(5) @MaxLength(150) address!: string;
  @Trim() @IsString() @MinLength(2) @MaxLength(50) city!: string;
  @Trim() @IsString() @MinLength(2) @MaxLength(50) state!: string;
  @Trim() @Matches(/^[A-Za-z0-9 -]{3,12}$/) postalCode!: string;
  @Trim() @IsString() @MinLength(2) @MaxLength(50) country!: string;
  @IsInt() @Min(1) @Max(1000000) floors!: number;
  @IsOptional() @Trim() @IsString() @MaxLength(1000) notes?: string;
  @Equals(true) authorized!: boolean;
}
export class PricingDto {
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(1) @Max(100) initialPercent!: number;
  @Trim()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  paymentInstructions!: string;
}
export class EvidenceDto {
  @IsUUID('4') requestId!: string;
  @IsInt() @Min(100) @Max(2000000000) @IsDivisibleBy(100) amountMinor!: number;
  @Trim()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 /._-]{3,99}$/)
  transactionReference!: string;
}
export class ReviewDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
  @Trim() @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
  @IsOptional() @Equals(true) confirmedAuthority?: boolean;
}
export class PaymentReviewDto {
  @IsIn(['VERIFIED', 'REJECTED']) decision!: 'VERIFIED' | 'REJECTED';
  @Trim() @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
export class SetupDto {
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class MockPaymentDto {
  @IsUUID('4') requestId!: string;
  @IsIn(['INITIAL', 'REMAINING']) phase!: 'INITIAL' | 'REMAINING';
}

export class AcceptanceDto {
  @Trim() @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
  @IsOptional() @Equals(true) confirmedAuthority?: boolean;
}
