import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class InviteClientDto {
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsEmail()
  contactEmail: string;
}
