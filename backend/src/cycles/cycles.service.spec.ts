import 'reflect-metadata';
import { Campus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CyclesService } from './cycles.service';

describe('CyclesService', () => {
  const teacher: AuthenticatedUser = {
    id: 'teacher-1',
    name: 'Teacher',
    username: 'teacher',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    campus: Campus.MAIN,
    avatarUrl: null,
  };

  it('creates a tracked cycle and a published four-criterion baseline survey', async () => {
    const criteria = ['Môi trường học tập', 'Kết nối cộng đồng', 'Hoạt động ngoại khóa', 'Hỗ trợ học tập']
      .map((name, index) => ({ id: `criterion-${index + 1}`, name, order: index + 1 }));
    const tx = {
      survey: { create: jest.fn().mockResolvedValue({ id: 'survey-1', criteria }) },
      question: { createMany: jest.fn().mockResolvedValue({ count: 4 }) },
      improvementCycle: { create: jest.fn().mockResolvedValue({ id: 'cycle-1', title: 'Ngày hội kết nối' }) },
    };
    const prisma = {
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
    };
    const service = new CyclesService(prisma as unknown as PrismaService);

    const result = await service.create({ title: '  Ngày hội kết nối  ' }, teacher);

    expect(tx.survey.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Khảo sát đầu vào: Ngày hội kết nối',
        published: true,
        criteria: { create: expect.arrayContaining([expect.objectContaining({ name: 'Kết nối cộng đồng' })]) },
      }),
    }));
    expect(tx.question.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ type: 'RATING' })]) }));
    expect(tx.improvementCycle.create).toHaveBeenCalledWith({ data: { title: 'Ngày hội kết nối', teacherId: teacher.id, baselineSurveyId: 'survey-1' } });
    expect(result).toMatchObject({ id: 'cycle-1', baselineSurvey: { id: 'survey-1', questionsCount: 4 } });
  });
});
