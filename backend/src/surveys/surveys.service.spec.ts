import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Campus, QuestionType, SurveyType, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { SurveysService } from './surveys.service';

describe('SurveysService', () => {
  let service: SurveysService;
  let prisma: {
    survey: { findUnique: jest.Mock };
    response: { create: jest.Mock };
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
      },
      response: { create: jest.fn().mockResolvedValue({ id: 'response-1' }) },
    };
    service = new SurveysService(prisma as unknown as PrismaService);
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
});
