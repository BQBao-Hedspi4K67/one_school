import { QuestionType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class QuestionDto {
  @IsString()
  @MinLength(3)
  prompt!: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  criterionId!: string;

  @IsBoolean()
  required!: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}
