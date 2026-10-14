import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { SurveyResultsService } from './survey-results.service';

@Module({
  imports: [AuthModule],
  controllers: [SurveysController],
  providers: [SurveysService, SurveyResultsService],
})
export class SurveysModule {}
