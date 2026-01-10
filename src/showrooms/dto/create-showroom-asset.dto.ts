import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShowroomAssetType } from '../schemas/showroom.schema';
import { ShowroomAssetFieldDto } from './showroom-asset-field.dto';

export class CreateShowroomAssetDto {
  @IsString()
  name: string;

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
}
