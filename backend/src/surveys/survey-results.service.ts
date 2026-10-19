import { Injectable } from '@nestjs/common';
import { Campus, Prisma, QuestionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { SurveyResults } from './survey-results.types';

type ResultsResponse = Prisma.ResponseGetPayload<{
  include: {
    student: { select: { campus: true } };
    answers: { include: { question: { include: { criterion: true } } } };
  };
}>;

/**
 * Tổng hợp kết quả một khảo sát theo cơ sở, tiêu chí và từng câu hỏi.
 * Chỉ dùng dữ liệu tổng hợp theo cơ sở, không đối chiếu học sinh cá nhân.
 */
@Injectable()
export class SurveyResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async getResults(surveyId: string): Promise<SurveyResults> {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        criteria: { orderBy: { order: 'asc' } },
        questions: { orderBy: { order: 'asc' }, include: { criterion: true } },
        _count: { select: { responses: true } },
      },
    });
    if (!survey) throw new Error('Không tìm thấy khảo sát');

    const [responses, studentsByCampus] = await Promise.all([
      this.loadResponses(surveyId),
      this.countStudentsByCampus(),
    ]);
    const scores = this.buildScores(responses);
    const responseCounts = this.countRespondents(responses);
    const breakdown = this.buildQuestionBreakdown(responses);
    const completed = this.countDistinctRespondents(responses);

    const mainScore = scores.overall.get(Campus.MAIN) ?? null;
    const branchScore = scores.overall.get(Campus.BRANCH) ?? null;

    return {
      survey: {
        id: survey.id,
        title: survey.title,
        type: survey.type,
        description: survey.description,
        published: survey.published,
        createdAt: survey.createdAt.toISOString(),
        responseCount: survey._count.responses,
        questionCount: survey.questions.length,
      },
      summary: {
        mainScore,
        branchScore,
        gap: this.gap(mainScore, branchScore),
        completion: {
          main: this.rate(completed.get(Campus.MAIN) ?? 0, studentsByCampus.main),
          branch: this.rate(
            completed.get(Campus.BRANCH) ?? 0,
            studentsByCampus.branch,
          ),
        },
        responseCount: {
          MAIN: completed.get(Campus.MAIN) ?? 0,
          BRANCH: completed.get(Campus.BRANCH) ?? 0,
        },
        studentCount: {
          MAIN: studentsByCampus.main,
          BRANCH: studentsByCampus.branch,
        },
        totalResponses: responses.length,
      },
      criterionComparison: survey.criteria.map((criterion) => {
        const campusScores = scores.criteria.get(criterion.id) ?? new Map();
        const main = campusScores.get(Campus.MAIN) ?? null;
        const branch = campusScores.get(Campus.BRANCH) ?? null;
        return {
          criterionId: criterion.id,
          criterionName: criterion.name,
          description: criterion.description,
          mainScore: main,
          branchScore: branch,
          gap: this.gap(main, branch),
          responseCount: {
            MAIN: responseCounts.get(criterion.id)?.get(Campus.MAIN)?.size ?? 0,
            BRANCH:
              responseCounts.get(criterion.id)?.get(Campus.BRANCH)?.size ?? 0,
          },
        };
      }),
      questionBreakdown: survey.questions.map((question) => {
        const entry = breakdown.get(question.id);
        return {
          questionId: question.id,
          questionText: question.prompt,
          type: question.type,
          criterionId: question.criterionId,
          criterionName: question.criterion.name,
          options: Array.isArray(question.options)
            ? question.options.map(String)
            : [],
          mainDistribution: entry?.mainDistribution ?? [],
          branchDistribution: entry?.branchDistribution ?? [],
          textAnswers: entry?.textAnswers ?? { MAIN: [], BRANCH: [] },
        };
      }),
    };
  }

  private async loadResponses(surveyId: string): Promise<ResultsResponse[]> {
    return this.prisma.response.findMany({
      where: { surveyId },
      include: {
        student: { select: { campus: true } },
        answers: { include: { question: { include: { criterion: true } } } },
      },
    });
  }

  private async countStudentsByCampus() {
    const grouped = await this.prisma.user.groupBy({
      by: ['campus'],
      where: { role: 'STUDENT', campus: { not: null } },
      _count: { _all: true },
    });
    return {
      main:
        grouped.find((item) => item.campus === Campus.MAIN)?._count._all ?? 0,
      branch:
        grouped.find((item) => item.campus === Campus.BRANCH)?._count._all ?? 0,
    };
  }


  /**
   * Điểm hài lòng: chuẩn hóa câu trả lời thang đo về 0–100,
   * trung bình các câu hỏi trong tiêu chí rồi trung bình các tiêu chí.
   */
  private buildScores(responses: ResultsResponse[]) {
    const criterionValues = new Map<string, Map<Campus, number[]>>();

    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;
      const perCriterion = new Map<string, number[]>();
      for (const answer of response.answers) {
        const score = this.toScore(answer.value, answer.question.type);
        if (score === null) continue;
        const values = perCriterion.get(answer.question.criterionId) ?? [];
        values.push(score);
        perCriterion.set(answer.question.criterionId, values);
      }
      for (const [criterionId, values] of perCriterion) {
        const byCampus =
          criterionValues.get(criterionId) ?? new Map<Campus, number[]>();
        const existing = byCampus.get(campus) ?? [];
        existing.push(this.average(values));
        byCampus.set(campus, existing);
        criterionValues.set(criterionId, byCampus);
      }
    }

    const criteria = new Map<string, Map<Campus, number | null>>();
    for (const [criterionId, byCampus] of criterionValues) {
      const perCampus = new Map<Campus, number | null>();
      for (const campus of [Campus.MAIN, Campus.BRANCH]) {
        const values = byCampus.get(campus) ?? [];
        perCampus.set(
          campus,
          values.length ? this.round(this.average(values)) : null,
        );
      }
      criteria.set(criterionId, perCampus);
    }

    const overall = new Map<Campus, number | null>();
    for (const campus of [Campus.MAIN, Campus.BRANCH]) {
      const values = [...criteria.values()]
        .map((perCampus) => perCampus.get(campus))
        .filter((value): value is number => this.isNumber(value));
      overall.set(
        campus,
        values.length ? this.round(this.average(values)) : null,
      );
    }

    return { criteria, overall };
  }

  private countRespondents(responses: ResultsResponse[]) {
    const counts = new Map<string, Map<Campus, Set<string>>>();
    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;
      for (const answer of response.answers) {
        const criterionId = answer.question.criterionId;
        const byCampus =
          counts.get(criterionId) ?? new Map<Campus, Set<string>>();
        const students = byCampus.get(campus) ?? new Set<string>();
        students.add(response.studentId);
        byCampus.set(campus, students);
        counts.set(criterionId, byCampus);
      }
    }
    return counts;
  }

  private buildQuestionBreakdown(responses: ResultsResponse[]) {
    type Entry = {
      mainDistribution: Map<string, number>;
      branchDistribution: Map<string, number>;
      textAnswers: { MAIN: string[]; BRANCH: string[] };
    };
    const questions = new Map<string, Entry>();

    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;
      for (const answer of response.answers) {
        const entry: Entry = questions.get(answer.questionId) ?? {
          mainDistribution: new Map<string, number>(),
          branchDistribution: new Map<string, number>(),
          textAnswers: { MAIN: [], BRANCH: [] },
        };

        if (answer.question.type === QuestionType.OPEN_TEXT) {
          const text =
            typeof answer.value === 'string' ? answer.value.trim() : '';
          if (text) entry.textAnswers[campus].push(text);
        } else {
          const distribution =
            campus === Campus.BRANCH
              ? entry.branchDistribution
              : entry.mainDistribution;
          for (const label of this.answerLabels(answer.value)) {
            distribution.set(label, (distribution.get(label) ?? 0) + 1);
          }
        }
        questions.set(answer.questionId, entry);
      }
    }

    return new Map(
      [...questions.entries()].map(([questionId, entry]) => [
        questionId,
        {
          mainDistribution: this.toDistribution(entry.mainDistribution),
          branchDistribution: this.toDistribution(entry.branchDistribution),
          textAnswers: entry.textAnswers,
        },
      ]),
    );
  }

  private answerLabels(value: Prisma.JsonValue): string[] {
    if (Array.isArray(value))
      return value.map((item) =>
        typeof item === 'string' ? item : String(item),
      );
    if (typeof value === 'string') return [value];
    if (typeof value === 'number') return [String(value)];
    return ['Khác'];
  }

  private countDistinctRespondents(responses: ResultsResponse[]) {
    const result = new Map<Campus, Set<string>>();
    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;
      const ids = result.get(campus) ?? new Set<string>();
      ids.add(response.studentId);
      result.set(campus, ids);
    }
    return new Map(
      [...result].map(([campus, ids]) => [campus, ids.size] as const),
    );
  }

  private toScore(value: Prisma.JsonValue, type: QuestionType): number | null {
    if (type !== QuestionType.RATING) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (value < 1 || value > 5) return null;
    return ((value - 1) / 4) * 100;
  }

  private toDistribution(values: Map<string, number>) {
    return [...values.entries()].map(([label, count]) => ({ label, count }));
  }

  private rate(numerator: number, denominator: number): number | null {
    return denominator ? this.round((numerator / denominator) * 100) : null;
  }

  private average(values: number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private gap(main: number | null, branch: number | null) {
    return main !== null && branch !== null ? this.round(main - branch) : null;
  }

  private round(value: number) {
    return Math.round(value * 10) / 10;
  }

  private isNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}

