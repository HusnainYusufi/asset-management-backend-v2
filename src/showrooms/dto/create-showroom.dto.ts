import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ShowroomMetaFieldDto, ShowroomTemplateDto } from './showroom-meta.dto';

export class CreateShowroomDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShowroomMetaFieldDto)
  metaFields?: ShowroomMetaFieldDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShowroomTemplateDto)
  templates?: ShowroomTemplateDto[];
}
