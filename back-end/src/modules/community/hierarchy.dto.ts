import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

class TimestampedEntity {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class Community extends TimestampedEntity {
  @ApiProperty() name!: string;
  @ApiProperty() address!: string;
  @ApiPropertyOptional() description?: string;
}
export class CommunityDetailsDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(250) address!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class CreateCommunityDto extends CommunityDetailsDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) adminName!: string;
  @ApiProperty() @IsEmail() @MaxLength(160) adminEmail!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MinLength(8) @MaxLength(128) adminPassword!: string;
  @ApiProperty() @IsInt() @Min(1) contractedTowers!: number;
  @ApiProperty() @IsInt() @Min(1) contractedApartments!: number;
}
export class UpdateCommunityDto extends PartialType(CommunityDetailsDto) {}

export class Tower extends TimestampedEntity {
  @ApiProperty() communityId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiPropertyOptional() description?: string;
}
export class CreateTowerDto {
  @ApiProperty() @IsUUID('4') communityId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) code!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class UpdateTowerDto extends PartialType(CreateTowerDto) {}

export class Floor extends TimestampedEntity {
  @ApiProperty() towerId!: string;
  @ApiProperty() floorNumber!: number;
  @ApiProperty() label!: string;
}
export class CreateFloorDto {
  @ApiProperty() @IsUUID('4') towerId!: string;
  @ApiProperty() @IsInt() @Min(0) floorNumber!: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(50) label!: string;
}
export class UpdateFloorDto extends PartialType(CreateFloorDto) {}

export class Apartment extends TimestampedEntity {
  @ApiProperty() floorId!: string;
  @ApiProperty() apartmentNumber!: string;
  @ApiProperty() label!: string;
}
export class CreateApartmentDto {
  @ApiProperty() @IsUUID('4') floorId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) apartmentNumber!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) label!: string;
}
export class UpdateApartmentDto extends PartialType(CreateApartmentDto) {}

export class AssociateApartmentDto { @ApiProperty() @IsUUID('4') apartmentId!: string; }
export class AssociateTowerDto { @ApiProperty() @IsUUID('4') towerId!: string; }
