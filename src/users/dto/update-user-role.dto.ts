import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../schemas/user.schema';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  clientId?: string;
}
