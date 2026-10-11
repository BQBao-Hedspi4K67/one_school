import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SurveyType } from '@prisma/client';

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  surveyId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsEnum(SurveyType)
  surveyType?: SurveyType;
}
