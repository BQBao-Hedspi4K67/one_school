import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Campus, QuestionType, SurveyType, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { SurveyResultsService } from './survey-results.service';
import { SurveysService } from './surveys.service';

describe('SurveysService', () => {
  let service: SurveysService;
  let prisma: {
    survey: { findUnique: jest.Mock; update: jest.Mock };
    question: { findUnique: jest.Mock; update: jest.Mock };
    criterion: { findFirst: jest.Mock };
    response: { create: jest.Mock; count: jest.Mock };
  };

  const teacher: AuthenticatedUser = {
    id: 'teacher-1',
    name: 'Teacher',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    campus: Campus.MAIN,
    avatarUrl: null,
  };

  const user: AuthenticatedUser = {
    id: 'student-1',
    name: 'Student',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    campus: Campus.MAIN,
    avatarUrl: null,
  };

  beforeEach(() => {
    prisma = {
      survey: {
        findUnique: jest.fn().mockResolvedValue({
          published: true,
          type: SurveyType.BASELINE,
          eventId: null,
          teacherId: 'teacher-1',
          closedAt: null,
          questions: [
            {
              id: 'question-1',
              prompt: 'Câu hỏi mới',
              type: QuestionType.RATING,
              options: ['1', '2', '3', '4', '5'],
              required: true,
            },
          ],
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            published: true,
            type: SurveyType.BASELINE,
            eventId: null,
            teacherId: 'teacher-1',
            questions: [],
            criteria: [],
            _count: { responses: 0 },
            closedAt: data.closedAt ?? null,
          }),
        ),
      },
      question: {
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation((args) => Promise.resolve(args.data)),
      },
      criterion: { findFirst: jest.fn() },
      response: {
        create: jest.fn().mockResolvedValue({ id: 'response-1' }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new SurveysService(
      prisma as unknown as PrismaService,
      new SurveyResultsService(prisma as unknown as PrismaService),
    );
  });

  it('accepts numeric answers for rating options stored as strings', async () => {
    await expect(
      service.submit(
        'survey-1',
        { answers: [{ questionId: 'question-1', value: 5 }] },
        user,
      ),
    ).resolves.toEqual({ id: 'response-1' });

    expect(prisma.response.create).toHaveBeenCalled();
  });

  it('rejects a rating that is not one of the configured options', async () => {
    await expect(
      service.submit(
        'survey-1',
        { answers: [{ questionId: 'question-1', value: 6 }] },
        user,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.response.create).not.toHaveBeenCalled();
  });

  it('rejects submissions once the survey is closed', async () => {
    prisma.survey.findUnique.mockResolvedValue({
      published: true,
      type: SurveyType.BASELINE,
      eventId: null,
      closedAt: new Date(Date.now() - 60_000),
      questions: [],
    });

    await expect(
      service.submit('survey-1', { answers: [] }, user),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.response.create).not.toHaveBeenCalled();
  });

  it('closes a survey immediately when no scheduled time is given', async () => {
    const result = await service.close('survey-1', {}, teacher);

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'survey-1' },
        data: { closedAt: expect.any(Date) },
      }),
    );
    expect(result).toHaveProperty('closed', true);
  });

  it('schedules a future closing time', async () => {
    const closesAt = new Date(Date.now() + 60 * 60_000).toISOString();

    await service.close('survey-1', { closesAt }, teacher);

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { closedAt: new Date(closesAt) },
      }),
    );
  });

  it('rejects a closing time in the past', async () => {
    const closesAt = new Date(Date.now() - 60_000).toISOString();

    await expect(
      service.close('survey-1', { closesAt }, teacher),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  it('reopens a survey by clearing its closing time', async () => {
    const result = await service.reopen('survey-1', teacher);

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { closedAt: null } }),
    );
    expect(result).toHaveProperty('closed', false);
  });

  describe('updateQuestion', () => {
    const existingQuestion = {
      id: 'question-1',
      surveyId: 'survey-1',
      prompt: 'Câu hỏi đã có phản hồi',
      type: QuestionType.RATING,
      options: ['1', '2', '3', '4', '5'],
      required: true,
      criterionId: 'criterion-1',
      order: 1,
    };

    const criterionOnlyDto = {
      prompt: existingQuestion.prompt,
      type: existingQuestion.type,
      criterionId: 'criterion-2',
      required: existingQuestion.required,
      options: existingQuestion.options,
    };

    beforeEach(() => {
      prisma.question.findUnique.mockResolvedValue(existingQuestion);
      prisma.criterion.findFirst.mockResolvedValue({
        id: 'criterion-2',
        surveyId: 'survey-1',
      });
      prisma.response.count.mockResolvedValue(3);
    });

    it('allows reassigning the criterion even when the survey already has responses', async () => {
      const result = await service.updateQuestion(
        'question-1',
        criterionOnlyDto,
        teacher,
      );

      expect(prisma.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'question-1' },
          data: expect.objectContaining({ criterionId: 'criterion-2' }),
        }),
      );
      expect(result).toMatchObject({ criterionId: 'criterion-2' });
    });

    it('rejects structural changes while the survey has responses', async () => {
      await expect(
        service.updateQuestion(
          'question-1',
          { ...criterionOnlyDto, prompt: 'Nội dung mới' },
          teacher,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.question.update).not.toHaveBeenCalled();
    });

    it('keeps allowing structural changes while the survey has no responses', async () => {
      prisma.response.count.mockResolvedValue(0);

      await service.updateQuestion(
        'question-1',
        { ...criterionOnlyDto, prompt: 'Nội dung mới' },
        teacher,
      );

      expect(prisma.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ prompt: 'Nội dung mới' }),
        }),
      );
    });

    it('still rejects a criterion that belongs to another survey', async () => {
      prisma.criterion.findFirst.mockResolvedValue(null);

      await expect(
        service.updateQuestion('question-1', criterionOnlyDto, teacher),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.question.update).not.toHaveBeenCalled();
    });
  });
});
