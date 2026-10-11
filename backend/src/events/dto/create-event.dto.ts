import { Campus } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export enum DeliveryMode {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  HYBRID = 'HYBRID',
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  coverImageUrl?: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsEnum(DeliveryMode)
  deliveryMode!: DeliveryMode;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetGrades!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Campus, { each: true })
  targetCampuses!: Campus[];

  @IsString()
  @IsNotEmpty()
  baselineSurveyId!: string;
}
