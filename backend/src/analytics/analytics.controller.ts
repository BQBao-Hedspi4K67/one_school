import { Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import type { AnalysisKind } from './analysis-kind';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard/details')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  dashboardDetails(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analytics.getDashboard(query, user, true);
  }

  @Get('dashboard')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  dashboard(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analytics.getDashboard(query, user);
  }

  @Get('analysis')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  surveyAnalysis(
    @Query('surveyId') surveyId: string,
    @Query('eventId') eventId: string,
    @Query('kind') kind: AnalysisKind,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analytics.getSurveyAnalysis(surveyId, user, eventId, kind);
  }

  @Post('recalculate/:eventId')
  recalculate(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analytics.recalculateEvent(eventId, user);
  }

  @Post('analysis')
  analyze(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analytics.createAnalysis(query, user);
  }

  @Post('analysis/:id/retry')
  retry(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.analytics.retryAnalysis(id, user);
  }
}
