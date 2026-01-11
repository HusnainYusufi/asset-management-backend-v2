import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AssetFieldDto } from './asset-field.dto';
import { AssetType } from '../schemas/asset.schema';

export class CreateAssetDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsEnum(AssetType)
  type?: AssetType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssetFieldDto)
  fields?: AssetFieldDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
