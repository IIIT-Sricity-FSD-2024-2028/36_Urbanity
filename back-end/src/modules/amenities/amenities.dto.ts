import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class AmenityDto {
  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  @Max(1440)
  bookingIntervalMinutes: number = 1;
  @ApiProperty({ default: 0 })
  @IsInt()
  @Min(0)
  @Max(1440)
  turnaroundMinutes: number = 0;
  @ApiProperty({ default: false })
  @IsBoolean()
  allowExtensions: boolean = false;
  @ApiProperty({ default: 0 })
  @IsInt()
  @Min(0)
  @Max(525600)
  cancellationCutoffMinutes: number = 0;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @MaxLength(2000) description!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
  @ApiProperty({ example: 'Asia/Kolkata' })
  @IsString()
  @MaxLength(100)
  timeZone!: string;
  @ApiProperty({ example: [1, 2, 3, 4, 5, 6, 0] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays!: number[];
  @ApiProperty({ example: '08:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  opensAt!: string;
  @ApiProperty({ example: '22:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closesAt!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10000) capacity!: number;
  @ApiProperty() @IsBoolean() exclusive!: boolean;
  @ApiProperty() @IsInt() @Min(1) @Max(1440) minDurationMinutes!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(1440) maxDurationMinutes!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(100) maxActiveBookings!: number;
  @ApiProperty({
    description:
      'Minimum notice before reservation start, in elapsed 24-hour days. Zero permits same-day reservations. The field name is retained for API compatibility.',
  })
  @IsInt()
  @Min(0)
  @Max(365)
  advanceDays!: number;
  @ApiProperty() @IsBoolean() requiresApproval!: boolean;
  @ApiProperty({ description: 'Flat booking fee in INR paise' })
  @IsInt()
  @Min(0)
  @Max(100000000)
  feeMinor!: number;
  @ApiProperty({ description: 'Refundable deposit in INR paise' })
  @IsInt()
  @Min(0)
  @Max(100000000)
  depositMinor!: number;
}

export class BookingWindowDto {
  @ApiProperty()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt!: string;
  @ApiProperty()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10000) attendees!: number;
}
export class CreateBookingDto extends BookingWindowDto {
  @ApiProperty({ required: false })
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID('4')
  clientRequestId?: string;
  @ApiProperty() @IsInt() @Min(0) @Max(100000000) expectedFeeMinor!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(100000000) expectedDepositMinor!: number;
}
export class DayAvailabilityDto {
  @ApiProperty({ example: '2026-10-20' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10000) attendees!: number;
  @ApiProperty({ required: false })
  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string;
}
export class ChangeAvailabilityDto extends DayAvailabilityDto {
  @ApiProperty({ enum: ['EDIT', 'EXTEND'] })
  @IsIn(['EDIT', 'EXTEND'])
  kind!: 'EDIT' | 'EXTEND';
}
export class ChangeBookingDto extends BookingWindowDto {
  @ApiProperty() @IsUUID('4') clientRequestId!: string;
  @ApiProperty() @IsInt() @Min(1) expectedVersion!: number;
  @ApiProperty({ enum: ['EDIT', 'EXTEND'] })
  @IsIn(['EDIT', 'EXTEND'])
  kind!: 'EDIT' | 'EXTEND';
}
export class ReasonDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason!: string;
}
export class MaintenanceBlockDto extends ReasonDto {
  @ApiProperty()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt!: string;
  @ApiProperty()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt!: string;
}
