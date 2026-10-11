import { Campus, QuestionType } from '@prisma/client';
import { calculateCampusScores, normalizeRating } from './scoring';

describe('deterministic scoring', () => {
  it('normalizes a 1-5 rating to 0-100', () => {
    expect(normalizeRating(1)).toBe(0);
    expect(normalizeRating(3)).toBe(50);
    expect(normalizeRating(5)).toBe(100);
    expect(normalizeRating(6)).toBeNull();
  });

  it('calculates independent campus criterion scores', () => {
    const result = calculateCampusScores([
      {
        student: { campus: Campus.MAIN },
        answers: [
          {
            value: 5,
            question: {
              type: QuestionType.RATING,
              criterionId: 'connection',
            },
          },
        ],
      },
      {
        student: { campus: Campus.BRANCH },
        answers: [
          {
            value: 3,
            question: {
              type: QuestionType.RATING,
              criterionId: 'connection',
            },
          },
        ],
      },
    ]);

    expect(result.overall.get(Campus.MAIN)).toBe(100);
    expect(result.overall.get(Campus.BRANCH)).toBe(50);
    expect(
      result.criteria.get('connection')?.get(Campus.BRANCH)?.responseCount,
    ).toBe(1);
  });

  it('ignores open text and averages available criteria evenly', () => {
    const result = calculateCampusScores([
      {
        student: { campus: Campus.MAIN },
        answers: [
          {
            value: 'text',
            question: {
              type: QuestionType.OPEN_TEXT,
              criterionId: 'text',
            },
          },
          {
            value: 5,
            question: {
              type: QuestionType.RATING,
              criterionId: 'criterion-1',
            },
          },
          {
            value: 1,
            question: {
              type: QuestionType.RATING,
              criterionId: 'criterion-2',
            },
          },
        ],
      },
    ]);

    expect(result.overall.get(Campus.MAIN)).toBe(50);
    expect(result.overall.get(Campus.BRANCH)).toBeNull();
  });
});
