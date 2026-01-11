import { IsEmail, IsMongoId, IsString, MinLength } from 'class-validator';

export class SetupSuperAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsString()
  setupKey: string;

  @IsMongoId()
  roleId: string;
}
