import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ShowroomAssetFieldType } from '../schemas/showroom.schema';

export class ShowroomAssetFieldDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsEnum(ShowroomAssetFieldType)
  type?: ShowroomAssetFieldType;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;

  @IsOptional()
  @IsString()
  value?: string;
}
