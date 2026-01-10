import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetFieldType } from '../schemas/asset.schema';

export class AssetFieldDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsEnum(AssetFieldType)
  type?: AssetFieldType;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;

  @IsOptional()
  @IsString()
  value?: string;
}
