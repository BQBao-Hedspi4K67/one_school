import { EventStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class EventQueryDto {
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
