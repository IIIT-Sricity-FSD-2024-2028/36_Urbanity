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
} from 'class-validator';

export class AmenityDto {
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
  @ApiProperty() @IsInt() @Min(1) @Max(365) advanceDays!: number;
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
  @ApiProperty() @IsInt() @Min(0) @Max(100000000) expectedFeeMinor!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(100000000) expectedDepositMinor!: number;
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
