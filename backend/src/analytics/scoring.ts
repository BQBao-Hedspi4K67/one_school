import { Campus, Prisma, QuestionType } from '@prisma/client';

export const CALCULATION_VERSION = 'equal-criteria-score-v2';

export type ScoringAnswer = {
  value: Prisma.JsonValue;
  question: {
    type: QuestionType;
    criterionId: string;
  };
};

export type ScoringResponse = {
  student: { campus: Campus | null };
  answers: ScoringAnswer[];
};

export type CriterionCampusScore = {
  score: number | null;
  responseCount: number;
};

export type CampusScores = {
  criteria: Map<string, Map<Campus, CriterionCampusScore>>;
  overall: Map<Campus, number | null>;
};

export function normalizeRating(value: Prisma.JsonValue): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 1 || value > 5) return null;
  return round(((value - 1) / 4) * 100);
}

export function scoreAnswer(
  value: Prisma.JsonValue,
  type: QuestionType,
): number | null {
  if (type !== QuestionType.RATING) return null;
  return normalizeRating(value);
}

export function calculateCampusScores(
  responses: ScoringResponse[],
): CampusScores {
  const criterionValues = new Map<string, Map<Campus, number[]>>();

  for (const response of responses) {
    const campus = response.student.campus;
    if (!campus) continue;

    for (const answer of response.answers) {
      const score = scoreAnswer(answer.value, answer.question.type);
      if (score === null) continue;
      const criterionId = answer.question.criterionId;
      const campusValues =
        criterionValues.get(criterionId) ?? new Map<Campus, number[]>();
      const values = campusValues.get(campus) ?? [];
      values.push(score);
      campusValues.set(campus, values);
      criterionValues.set(criterionId, campusValues);
    }
  }

  const criteria = new Map<string, Map<Campus, CriterionCampusScore>>();
  for (const [criterionId, campusValues] of criterionValues) {
    const result = new Map<Campus, CriterionCampusScore>();
    for (const campus of [Campus.MAIN, Campus.BRANCH]) {
      const values = campusValues.get(campus) ?? [];
      result.set(campus, {
        score: values.length ? round(average(values)) : null,
        responseCount: values.length,
      });
    }
    criteria.set(criterionId, result);
  }

  const overall = new Map<Campus, number | null>();
  for (const campus of [Campus.MAIN, Campus.BRANCH]) {
    const scores = [...criteria.values()]
      .map((campusScores) => campusScores.get(campus)?.score ?? null)
      .filter((score): score is number => score !== null);
    overall.set(campus, scores.length ? round(average(scores)) : null);
  }

  return { criteria, overall };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
