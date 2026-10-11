import { RegistrationStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRegistrationDto {
  @IsEnum(RegistrationStatus)
  status!: RegistrationStatus;
}
