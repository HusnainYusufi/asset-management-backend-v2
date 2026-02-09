import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ShowroomAssetType } from '../schemas/showroom.schema';
import { ShowroomAssetFieldDto } from './showroom-asset-field.dto';

export class UpdateShowroomAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ShowroomAssetType)
  type?: ShowroomAssetType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShowroomAssetFieldDto)
  fields?: ShowroomAssetFieldDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @ValidateIf((_o, value) => value !== null && value !== undefined && value !== '')
  @IsDateString()
  expirationDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  expirationNotificationsEnabled?: boolean;
}
