import { Campus, QuestionType, SurveyType } from '@prisma/client';
import { SurveyResultsService } from './survey-results.service';

describe('SurveyResultsService', () => {
  const buildPrisma = (responses: unknown[]) => {
    const surveyFindUnique = jest.fn().mockResolvedValue({
      id: 'survey-1',
      title: 'Khảo sát thực trạng',
      type: SurveyType.BASELINE,
      description: 'Mô tả',
      published: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      _count: { responses: responses.length },
      criteria: [
        { id: 'criterion-1', order: 1, description: null },
        { id: 'criterion-2', order: 2, description: null },
      ],
      questions: [
        {
          id: 'question-1',
          prompt: 'Bạn đánh giá tiêu chí 1 như thế nào?',
          type: QuestionType.RATING,
          criterionId: 'criterion-1',
          criterion: { order: 1 },
          options: ['1', '2', '3', '4', '5'],
        },
        {
          id: 'question-2',
          prompt: 'Điều bạn mong muốn cải thiện?',
          type: QuestionType.OPEN_TEXT,
          criterionId: 'criterion-2',
          criterion: { order: 2 },
          options: null,
        },
      ],
    });
    return {
      survey: { findUnique: surveyFindUnique },
      response: { findMany: jest.fn().mockResolvedValue(responses) },
      user: {
        groupBy: jest.fn().mockResolvedValue([
          { campus: Campus.MAIN, _count: { _all: 10 } },
          { campus: Campus.BRANCH, _count: { _all: 8 } },
        ]),
      },
    };
  };

  const rating = (value: number, criterionId: string) => ({
    questionId: criterionId === 'criterion-1' ? 'question-1' : 'question-2',
    value,
    question: { type: QuestionType.RATING, criterionId, criterion: {} },
  });

  const openText = (text: string) => ({
    questionId: 'question-2',
    value: text,
    question: {
      type: QuestionType.OPEN_TEXT,
      criterionId: 'criterion-2',
      criterion: {},
    },
  });

  it('aggregates satisfaction, distributions and open text per campus', async () => {
    const prisma = buildPrisma([
      {
        studentId: 'student-1',
        student: { campus: Campus.MAIN },
        answers: [
          rating(5, 'criterion-1'),
          openText('Thêm hoạt động ngoại khóa'),
        ],
      },
      {
        studentId: 'student-2',
        student: { campus: Campus.BRANCH },
        answers: [
          rating(3, 'criterion-1'),
          openText('Cần thêm sách thư viện'),
        ],
      },
    ]);

    const service = new SurveyResultsService(prisma as never);
    const results = await service.getResults('survey-1');

    expect(results.survey.responseCount).toBe(2);
    expect(results.summary.mainScore).toBe(100);
    expect(results.summary.branchScore).toBe(50);
    expect(results.summary.gap).toBe(50);
    expect(results.summary.completion).toEqual({ main: 10, branch: 12.5 });
    expect(results.summary.responseCount).toEqual({ MAIN: 1, BRANCH: 1 });

    const firstCriterion = results.criterionComparison[0];
    expect(firstCriterion.criterionName).toBe('Tiêu chí 1');
    expect(firstCriterion.mainScore).toBe(100);
    expect(firstCriterion.branchScore).toBe(50);

    const ratingQuestion = results.questionBreakdown[0];
    expect(ratingQuestion.mainDistribution).toEqual([{ label: '5', count: 1 }]);
    expect(ratingQuestion.branchDistribution).toEqual([{ label: '3', count: 1 }]);

    const openQuestion = results.questionBreakdown[1];
    expect(openQuestion.textAnswers.MAIN).toEqual(['Thêm hoạt động ngoại khóa']);
    expect(openQuestion.textAnswers.BRANCH).toEqual(['Cần thêm sách thư viện']);
    expect(openQuestion.mainDistribution).toEqual([]);
  });

  it('returns null scores when a campus has no valid rating', async () => {
    const prisma = buildPrisma([
      {
        studentId: 'student-1',
        student: { campus: Campus.MAIN },
        answers: [rating(4, 'criterion-1')],
      },
    ]);

    const service = new SurveyResultsService(prisma as never);
    const results = await service.getResults('survey-1');

    expect(results.summary.mainScore).toBe(75);
    expect(results.summary.branchScore).toBeNull();
    expect(results.summary.gap).toBeNull();
    expect(results.summary.completion.branch).toBe(0);
  });
});
