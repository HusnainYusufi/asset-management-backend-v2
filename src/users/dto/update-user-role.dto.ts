import { IsMongoId, IsOptional } from 'class-validator';

export class UpdateUserRoleDto {
  @IsMongoId()
  roleId: string;

  @IsOptional()
  @IsMongoId()
  clientId?: string;
}
