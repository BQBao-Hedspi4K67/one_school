import { SurveyType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateSurveyDto {
  @IsEnum(SurveyType)
  type!: SurveyType;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
