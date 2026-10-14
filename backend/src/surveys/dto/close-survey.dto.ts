import { IsDateString, IsOptional } from 'class-validator';

export class CloseSurveyDto {
  @IsOptional()
  @IsDateString()
  closesAt?: string;
}
