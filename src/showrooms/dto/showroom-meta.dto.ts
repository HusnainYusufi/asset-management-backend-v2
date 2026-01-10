import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ShowroomMetaFieldDto {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

export class ShowroomTemplateSizeDto {
  @IsString()
  label: string;

  @Type(() => Number)
  width: number;

  @Type(() => Number)
  height: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class ShowroomTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShowroomTemplateSizeDto)
  sizes?: ShowroomTemplateSizeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShowroomMetaFieldDto)
  metaFields?: ShowroomMetaFieldDto[];
}
