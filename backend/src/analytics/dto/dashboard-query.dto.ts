import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { SurveyType } from '@prisma/client';
import { ANALYSIS_KINDS, type AnalysisKind } from '../analysis-kind';

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

  /** OVERVIEW: dashboard tổng thể; BASELINE/EFFECTIVENESS: hai điểm AI trong chu trình */
  @IsOptional()
  @IsIn(ANALYSIS_KINDS)
  kind?: AnalysisKind;
}
