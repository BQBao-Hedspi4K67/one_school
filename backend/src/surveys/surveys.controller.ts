import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { UpdateSurveyDto } from './dto/update-survey.dto';
import { QuestionDto } from './dto/question.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { SurveysService } from './surveys.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SurveysController {
  constructor(private readonly surveys: SurveysService) {}

  @Get('surveys') list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('eventId') eventId?: string,
  ) {
    return this.surveys.list(user, eventId);
  }
  @Get('surveys/:id') get(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.get(id, user);
  }
  @Post('surveys') @Roles(UserRole.TEACHER) create(
    @Body() dto: CreateSurveyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.create(dto, user);
  }
  @Post('events/:eventId/surveys') @Roles(UserRole.TEACHER) createForEvent(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.createForEvent(eventId, user);
  }
  @Patch('surveys/:id') @Roles(UserRole.TEACHER) update(
    @Param('id') id: string,
    @Body() dto: UpdateSurveyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.update(id, dto, user);
  }
  @Post('surveys/:id/publish') @Roles(UserRole.TEACHER) publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.publish(id, user);
  }
  @Post('surveys/:id/questions') @Roles(UserRole.TEACHER) addQuestion(
    @Param('id') id: string,
    @Body() dto: QuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.addQuestion(id, dto, user);
  }
  @Patch('questions/:id') @Roles(UserRole.TEACHER) updateQuestion(
    @Param('id') id: string,
    @Body() dto: QuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.updateQuestion(id, dto, user);
  }
  @Delete('questions/:id') @Roles(UserRole.TEACHER) removeQuestion(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.removeQuestion(id, user);
  }
  @Post('surveys/:id/questions/reorder') @Roles(UserRole.TEACHER) reorder(
    @Param('id') id: string,
    @Body() dto: ReorderQuestionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.reorderQuestions(id, dto, user);
  }
  @Post('surveys/:id/responses') @Roles(UserRole.STUDENT) submit(
    @Param('id') id: string,
    @Body() dto: SubmitResponseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.surveys.submit(id, dto, user);
  }
}
