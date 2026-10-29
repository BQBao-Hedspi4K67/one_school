import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Campus,
  EventStatus,
  Prisma,
  QuestionType,
  RegistrationStatus,
  SurveyType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { deriveEventStatus } from '../events/event-status';
import {
  CampusScore,
  DashboardFilters,
  DashboardResponse,
} from './analytics.types';
import { CALCULATION_VERSION, calculateCampusScores } from './scoring';
import { POST_EVENT_CRITERIA } from '../surveys/post-event-criteria';
import {
  type AnalysisKind,
  analysisSystemPrompt,
  isAnalysisKind,
  resolveAnalysisKind,
} from './analysis-kind';

type ResponseWithAnswers = Prisma.ResponseGetPayload<{
  select: {
    id: true;
    surveyId: true;
    studentId: true;
    student: { select: { campus: true } };
    answers: {
      select: {
        questionId: true;
        value: true;
        question: {
          select: {
            id: true;
            prompt: true;
            type: true;
            criterionId: true;
            criterion: { select: { id: true; name: true } };
          };
        };
      };
    };
  };
}>;

type ScoreMap = Map<string, Map<Campus, number>>;

type DashboardAggregateRow = {
  section: 'CYCLE_CRITERION' | 'OVERALL' | 'RESPONDENTS' | 'DISTRIBUTION' | 'GLOBAL';
  surveyId: string | null;
  campus: string | null;
  criterionId: string | null;
  criterionName: string | null;
  questionId: string | null;
  questionText: string | null;
  answerLabel: string | null;
  score: number | null;
  itemCount: number | null;
  responseCount: number | null;
};

type SurveyDashboardAggregate = {
  scoreByCampus: Map<Campus, number>;
  criterionComparison: DashboardResponse['criterionComparison'];
  questionBreakdown: DashboardResponse['questionBreakdown'];
  respondentCountByCampus: Map<Campus, number>;
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getDashboard(
    filters: DashboardFilters = {},
    user?: AuthenticatedUser,
    includeResponseDetails = false,
  ): Promise<DashboardResponse> {
    const timed = async <T>(phase: string, operation: () => Promise<T>) => {
      const startedAt = Date.now();
      try {
        return await operation();
      } finally {
        const durationMs = Date.now() - startedAt;
        if (durationMs >= 3000) {
          this.logger.warn(`[dashboard] phase=${phase} durationMs=${durationMs}`);
        }
      }
    };
    const defaultToBaseline =
      !filters.surveyId && !filters.eventId && !filters.surveyType;
    const [surveys, availableSurveys, events] = await timed(
      'metadata',
      () => Promise.all([
      this.prisma.survey.findMany({
        where: {
          ...(user?.role === UserRole.TEACHER ? { teacherId: user.id } : {}),
          ...(filters.surveyId ? { id: filters.surveyId } : {}),
          ...(filters.eventId ? { eventId: filters.eventId } : {}),
          ...(filters.surveyType || defaultToBaseline
            ? { type: filters.surveyType ?? SurveyType.BASELINE }
            : {}),
        },
        include: { event: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.survey.findMany({
        where: {
          published: true,
          ...(user?.role === UserRole.TEACHER ? { teacherId: user.id } : {}),
        },
        include: { event: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.event.findMany({
        where: {
          status: { not: 'DRAFT' },
          ...(user?.role === UserRole.TEACHER ? { teacherId: user.id } : {}),
        },
        select: { id: true, title: true },
        orderBy: { startAt: 'desc' },
      }),
      ]),
    );

    if (filters.surveyId && surveys.length === 0) {
      throw new NotFoundException('Không tìm thấy khảo sát được chọn');
    }
    if (filters.eventId && surveys.length === 0) {
      throw new NotFoundException(
        'Không tìm thấy dữ liệu khảo sát của sự kiện',
      );
    }

    const selectedSurveyIds = surveys.map((survey) => survey.id);
    const selectedEventIds = this.unique(
      surveys
        .map((survey) => survey.eventId)
        .filter((id): id is string => Boolean(id)),
    );
    const eventIds = filters.eventId ? [filters.eventId] : selectedEventIds;
    const [studentsByCampus, participants, aiInsight, kpiStats, eventCount] =
      await timed('summary-queries', () => Promise.all([
      this.countStudentsByCampus(),
      this.countParticipants(eventIds),
      this.getAiInsight(user?.id),
      this.buildKpiStats(user),
      this.countEvents(eventIds),
      ]));
    if (!includeResponseDetails) {
      return {
        kpiStats,
        allSurveysCriterionComparison: [],
        cycles: [],
        filters: {
          surveys: availableSurveys.map((survey) => ({
            id: survey.id,
            title: survey.title,
            type: survey.type,
            eventId: survey.eventId,
            eventTitle: survey.event?.title ?? null,
          })),
          events,
          selected: filters,
        },
        summary: {
          mainScore: null,
          branchScore: null,
          completionRate: null,
          eventCount,
          mainParticipants: participants.main,
          branchParticipants: participants.branch,
        },
        criterionComparison: [],
        questionBreakdown: [],
        participation: {
          ...participants,
          completion: { main: null, branch: null },
        },
        aiInsight,
        effectiveness: this.emptyEffectiveness(),
      };
    }
    // Aggregate answer rows inside PostgreSQL and return only per-survey
    // metrics/distributions instead of materializing every answer in Node.
    const aggregates = await timed(
      'response-aggregates',
      () => this.getDashboardAggregates(user),
    );
    const allSurveysCriterionComparison = aggregates.allSurveysCriterionComparison;
    const cycles = await timed('cycles', () => this.buildImprovementCycles(user, aggregates.bySurvey));
    const effectiveness = await timed(
      'effectiveness',
      () => this.getEffectiveness(filters.eventId),
    );
    const selectedRespondents = await timed(
      'selected-survey-responses',
      () => this.countSelectedRespondents(selectedSurveyIds),
    );
    const selectedAggregates = selectedSurveyIds
      .map((surveyId) => aggregates.bySurvey.get(surveyId))
      .filter((aggregate): aggregate is SurveyDashboardAggregate => Boolean(aggregate));
    const selectedCriterionComparison = selectedAggregates.flatMap((aggregate) => aggregate.criterionComparison);
    const overall = this.averageCriterionComparison(selectedCriterionComparison);
    const completion = {
      main: this.rate(
        selectedRespondents.main,
        studentsByCampus.main,
      ),
      branch: this.rate(
        selectedRespondents.branch,
        studentsByCampus.branch,
      ),
    };
    const criterionComparison = selectedCriterionComparison;
    const questionBreakdown = selectedAggregates.flatMap((aggregate) => aggregate.questionBreakdown);
    return {
      kpiStats,
      allSurveysCriterionComparison,
      cycles,
      filters: {
        surveys: availableSurveys.map((survey) => ({
          id: survey.id,
          title: survey.title,
          type: survey.type,
          eventId: survey.eventId,
          eventTitle: survey.event?.title ?? null,
        })),
        events,
        selected: filters,
      },
      summary: {
        mainScore: overall.main,
        branchScore: overall.branch,
        completionRate: this.averageNullable(
          completion.main,
          completion.branch,
        ),
        eventCount,
        mainParticipants: participants.main,
        branchParticipants: participants.branch,
      },
      criterionComparison,
      questionBreakdown,
      participation: { ...participants, completion },
      aiInsight,
      effectiveness,
    };
  }

  private async buildKpiStats(user?: AuthenticatedUser) {
    const teacherFilter =
      user?.role === UserRole.TEACHER ? { teacherId: user.id } : {};

    const [openSurveysCount, totalStudentsCount, distinctRespondents, analyses, pendingAnalysisCount, events] = await Promise.all([
      this.prisma.survey.count({ where: { published: true, ...teacherFilter } }),
      this.prisma.user.count({ where: { role: UserRole.STUDENT } }),
      this.prisma.response.groupBy({
        by: ['studentId'],
        ...(user?.role === UserRole.TEACHER ? { where: { survey: { teacherId: user.id } } } : {}),
      }),
      this.prisma.aiAnalysis.findMany({
        where: { status: 'SUCCESS', ...(user?.role === UserRole.TEACHER ? { authorId: user.id } : {}) },
        select: { output: true }, orderBy: { createdAt: 'desc' }, take: 5,
      }),
      this.prisma.aiAnalysis.count({
        where: { status: 'PENDING', ...(user?.role === UserRole.TEACHER ? { authorId: user.id } : {}) },
      }),
      this.prisma.event.findMany({
        where: { status: { not: EventStatus.DRAFT }, ...teacherFilter },
        select: { status: true, startAt: true, endAt: true },
      }),
    ]);

    const totalPublishedSurveysCount = openSurveysCount;
    const respondedStudentsCount = distinctRespondents.length;
    const responseRate =
      totalStudentsCount > 0
        ? this.round((respondedStudentsCount / totalStudentsCount) * 100)
        : 0;

    // 3. Số khuyến nghị AI đang có / chờ thực hiện
    let pendingAiCount = 0;
    for (const a of analyses) {
      const out = this.asRecord(a.output);
      if (Array.isArray(out.recommendations)) {
        pendingAiCount += out.recommendations.length;
      }
    }
    // Nếu chưa có phân tích nào, đếm các phân tích đang PENDING
    if (pendingAiCount === 0) pendingAiCount = pendingAnalysisCount;

    // Đếm hoạt động theo trạng thái suy ra từ thời gian thực, không phụ thuộc
    // trạng thái lưu trong DB đã được đồng bộ hay chưa.
    const now = new Date();
    const eventCounts = events.reduce(
      (counts, event) => {
        const status = deriveEventStatus(event, now);
        if (status === EventStatus.COMPLETED) counts.completed += 1;
        if (status === EventStatus.LIVE) counts.live += 1;
        if (status === EventStatus.UPCOMING) counts.upcoming += 1;
        return counts;
      },
      { completed: 0, live: 0, upcoming: 0 },
    );

    return {
      openSurveysCount,
      totalPublishedSurveysCount,
      totalStudentsCount,
      respondedStudentsCount,
      responseRate,
      pendingAiCount,
      completedEventsCount: eventCounts.completed,
      liveEventsCount: eventCounts.live,
      upcomingEventsCount: eventCounts.upcoming,
    };
  }

  private async getDashboardAggregates(user?: AuthenticatedUser) {
    const teacherScope = user?.role === UserRole.TEACHER
      ? Prisma.sql`AND s."teacherId" = ${user.id}`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<DashboardAggregateRow[]>`
      WITH answer_rows AS (
        SELECT s.id AS "surveyId", s.type::text AS "surveyType", s.published,
               r.id AS "responseId", r."studentId", u.campus::text AS campus,
               q.id AS "questionId", q.prompt AS "questionText", q."criterionId",
               c.name AS "criterionName",
               CASE WHEN jsonb_typeof(a.value) IN ('number', 'string') THEN a.value #>> '{}' ELSE 'Khác' END AS "answerLabel",
               CASE WHEN q.type::text = 'RATING' THEN
                 CASE WHEN jsonb_typeof(a.value) = 'number' THEN
                   CASE WHEN (a.value #>> '{}')::numeric BETWEEN 1 AND 5
                     THEN ((a.value #>> '{}')::numeric - 1) * 25 ELSE NULL END
                   ELSE NULL END
                 ELSE NULL END AS score
        FROM "Answer" a
        JOIN "Response" r ON r.id = a."responseId"
        JOIN "Survey" s ON s.id = r."surveyId"
        JOIN "User" u ON u.id = r."studentId"
        JOIN "Question" q ON q.id = a."questionId"
        JOIN "Criterion" c ON c.id = q."criterionId"
        WHERE 1=1 ${teacherScope}
      ), response_criterion AS (
        SELECT "surveyId", "responseId", "studentId", campus, "criterionId", AVG(score) AS score
        FROM answer_rows WHERE score IS NOT NULL AND campus IS NOT NULL
        GROUP BY "surveyId", "responseId", "studentId", campus, "criterionId"
      ), criterion_counts AS (
        SELECT "surveyId", "criterionId", "criterionName", campus,
               COUNT(DISTINCT "studentId")::int AS "responseCount"
        FROM answer_rows WHERE campus IS NOT NULL
        GROUP BY "surveyId", "criterionId", "criterionName", campus
      ), criterion_scores AS (
        SELECT "surveyId", "criterionId", campus, ROUND(AVG(score), 1)::float8 AS score
        FROM response_criterion GROUP BY "surveyId", "criterionId", campus
      ), overall_scores AS (
        SELECT "surveyId", campus, ROUND(AVG(score)::numeric, 1)::float8 AS score
        FROM criterion_scores GROUP BY "surveyId", campus
      ), global_scores AS (
        SELECT "criterionName", campus, ROUND(AVG(score), 1)::float8 AS score,
               COUNT(DISTINCT "studentId")::int AS "responseCount"
        FROM answer_rows
        WHERE published AND "surveyType" = 'POST_EVENT' AND score IS NOT NULL AND campus IS NOT NULL
        GROUP BY "criterionName", campus
      ), distributions AS (
        SELECT "surveyId", "questionId", "questionText", "criterionName", campus,
               "answerLabel", COUNT(*)::int AS "itemCount"
        FROM answer_rows WHERE campus IS NOT NULL
        GROUP BY "surveyId", "questionId", "questionText", "criterionName", campus, "answerLabel"
      )
      SELECT 'CYCLE_CRITERION'::text AS section, cc."surveyId", cc.campus, cc."criterionId", cc."criterionName",
             NULL::text AS "questionId", NULL::text AS "questionText", NULL::text AS "answerLabel",
             cs.score, NULL::int AS "itemCount", cc."responseCount"
      FROM criterion_counts cc LEFT JOIN criterion_scores cs USING ("surveyId", "criterionId", campus)
      UNION ALL
      SELECT 'OVERALL', os."surveyId", os.campus, NULL, NULL, NULL, NULL, NULL, os.score, NULL::int, NULL::int FROM overall_scores os
      UNION ALL
      SELECT 'DISTRIBUTION', d."surveyId", d.campus, NULL, d."criterionName", d."questionId", d."questionText", d."answerLabel",
             NULL::float8, d."itemCount", NULL::int FROM distributions d
      UNION ALL
      SELECT 'GLOBAL', NULL::text, gs.campus, NULL, gs."criterionName", NULL, NULL, NULL, gs.score, NULL::int, gs."responseCount" FROM global_scores gs
    `;

    const bySurvey = new Map<string, SurveyDashboardAggregate>();
    const ensureSurvey = (id: string) => {
      let item = bySurvey.get(id);
      if (!item) {
        item = { scoreByCampus: new Map(), criterionComparison: [], questionBreakdown: [], respondentCountByCampus: new Map() };
        bySurvey.set(id, item);
      }
      return item;
    };
    const criterionMaps = new Map<string, Map<string, DashboardResponse['criterionComparison'][number]>>();
    const questionMaps = new Map<string, Map<string, { questionId: string; questionText: string; criterionName: string; main: Map<string, number>; branch: Map<string, number> }>>();
    const global = new Map<string, { MAIN: number | null; BRANCH: number | null; mainCount: number; branchCount: number }>();
    for (const row of rows) {
      if (row.section === 'GLOBAL' && row.criterionName && (row.campus === Campus.MAIN || row.campus === Campus.BRANCH)) {
        const item = global.get(row.criterionName) ?? { MAIN: null, BRANCH: null, mainCount: 0, branchCount: 0 };
        item[row.campus] = row.score;
        if (row.campus === Campus.MAIN) item.mainCount = row.responseCount ?? 0;
        else item.branchCount = row.responseCount ?? 0;
        global.set(row.criterionName, item);
        continue;
      }
      if (!row.surveyId) continue;
      const item = ensureSurvey(row.surveyId);
      if (row.section === 'OVERALL' && row.campus && row.score !== null) {
        item.scoreByCampus.set(row.campus as Campus, row.score);
      } else if (row.section === 'CYCLE_CRITERION' && row.criterionId && row.criterionName) {
        const byCriterion = criterionMaps.get(row.surveyId) ?? new Map();
        const criterion = byCriterion.get(row.criterionId) ?? {
          criterionId: row.criterionId, criterionName: row.criterionName, mainScore: null, branchScore: null, gap: null,
          responseCount: { MAIN: 0, BRANCH: 0 },
        };
        if (row.campus === Campus.MAIN || row.campus === Campus.BRANCH) {
          criterion[row.campus === Campus.MAIN ? 'mainScore' : 'branchScore'] = row.score;
          criterion.responseCount[row.campus] = row.responseCount ?? 0;
        }
        criterion.gap = this.gap(criterion.mainScore, criterion.branchScore);
        byCriterion.set(row.criterionId, criterion);
        criterionMaps.set(row.surveyId, byCriterion);
      } else if (row.section === 'DISTRIBUTION' && row.questionId && row.questionText && row.criterionName && row.campus && row.answerLabel !== null) {
        const byQuestion = questionMaps.get(row.surveyId) ?? new Map();
        const question = byQuestion.get(row.questionId) ?? {
          questionId: row.questionId, questionText: row.questionText, criterionName: row.criterionName,
          main: new Map<string, number>(), branch: new Map<string, number>(),
        };
        (row.campus === Campus.MAIN ? question.main : question.branch).set(row.answerLabel, row.itemCount ?? 0);
        byQuestion.set(row.questionId, question);
        questionMaps.set(row.surveyId, byQuestion);
      }
    }
    for (const [surveyId, criteria] of criterionMaps) ensureSurvey(surveyId).criterionComparison = [...criteria.values()];
    for (const [surveyId, questions] of questionMaps) {
      ensureSurvey(surveyId).questionBreakdown = [...questions.values()].map(({ main, branch, ...question }) => ({
        ...question,
        mainDistribution: [...main].map(([label, count]) => ({ label, count })),
        branchDistribution: [...branch].map(([label, count]) => ({ label, count })),
      }));
    }
    const allSurveysCriterionComparison = POST_EVENT_CRITERIA.map(({ name }) => {
      const item = global.get(name);
      return {
        criterionName: name, mainScore: item?.MAIN ?? null, branchScore: item?.BRANCH ?? null,
        gap: this.gap(item?.MAIN ?? null, item?.BRANCH ?? null),
        responseCount: { MAIN: item?.mainCount ?? 0, BRANCH: item?.branchCount ?? 0 },
      };
    });
    return { bySurvey, allSurveysCriterionComparison };
  }

  private async countSelectedRespondents(surveyIds: string[]) {
    if (surveyIds.length === 0) return { main: 0, branch: 0 };
    const rows = await this.prisma.$queryRaw<Array<{ campus: string; count: number }>>`
      SELECT u.campus::text AS campus, COUNT(DISTINCT r."studentId")::int AS count
      FROM "Response" r JOIN "User" u ON u.id = r."studentId"
      WHERE r."surveyId" IN (${Prisma.join(surveyIds)}) AND u.campus IS NOT NULL
      GROUP BY u.campus
    `;
    return {
      main: rows.find((row) => row.campus === Campus.MAIN)?.count ?? 0,
      branch: rows.find((row) => row.campus === Campus.BRANCH)?.count ?? 0,
    };
  }

  private averageCriterionComparison(criteria: DashboardResponse['criterionComparison']): CampusScore {
    const averageOrNull = (values: Array<number | null>) => {
      const present = values.filter((value): value is number => value !== null);
      return present.length ? this.round(this.average(present)) : null;
    };
    const main = averageOrNull(criteria.map((criterion) => criterion.mainScore));
    const branch = averageOrNull(criteria.map((criterion) => criterion.branchScore));
    return { main, branch, gap: this.gap(main, branch) };
  }

  private buildAllSurveysCriterionComparisonFromResponses(
    responses: ResponseWithAnswers[],
  ) {
    const valuesByName = new Map<string, Map<Campus, number[]>>(
      POST_EVENT_CRITERIA.map(({ name }) => [
        name,
        new Map<Campus, number[]>(),
      ]),
    );
    const responseCounts = new Map<string, Map<Campus, Set<string>>>();

    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;

      for (const answer of response.answers) {
        const score = this.toScore(answer.value, answer.question.type);
        if (score === null) continue;

        const name = answer.question.criterion.name;
        const campusMap = valuesByName.get(name);
        if (!campusMap) continue;
        const list = campusMap.get(campus) ?? [];
        list.push(score);
        campusMap.set(campus, list);
        valuesByName.set(name, campusMap);

        const countMap =
          responseCounts.get(name) ?? new Map<Campus, Set<string>>();
        const studentSet = countMap.get(campus) ?? new Set<string>();
        studentSet.add(response.studentId);
        countMap.set(campus, studentSet);
        responseCounts.set(name, countMap);
      }
    }

    return POST_EVENT_CRITERIA.map(({ name: criterionName }) => {
      const campusMap = valuesByName.get(criterionName)!;
      const mainScores = campusMap.get(Campus.MAIN) ?? [];
      const branchScores = campusMap.get(Campus.BRANCH) ?? [];
      const mainScore = mainScores.length
        ? this.round(this.average(mainScores))
        : null;
      const branchScore = branchScores.length
        ? this.round(this.average(branchScores))
        : null;
      return {
        criterionName,
        mainScore,
        branchScore,
        gap: this.gap(mainScore, branchScore),
        responseCount: {
          MAIN: responseCounts.get(criterionName)?.get(Campus.MAIN)?.size ?? 0,
          BRANCH:
            responseCounts.get(criterionName)?.get(Campus.BRANCH)?.size ?? 0,
        },
      };
    });
  }

  private async buildImprovementCycles(
    user?: AuthenticatedUser,
    surveyAggregates?: Map<string, SurveyDashboardAggregate>,
  ): Promise<DashboardResponse['cycles']> {
    const cycleRecords = await this.prisma.improvementCycle.findMany({
      where: { ...(user?.role === UserRole.TEACHER ? { teacherId: user.id } : {}) },
      select: { id: true, eventId: true, baselineSurveyId: true, title: true, createdAt: true },
    });
    const cycleByEvent = new Map(cycleRecords.filter((cycle) => cycle.eventId).map((cycle) => [cycle.eventId!, cycle]));
    const events = await this.prisma.event.findMany({
      where: {
        ...(user?.role === UserRole.TEACHER ? { teacherId: user.id } : {}),
      },
      include: {
        baselineSurvey: {
          include: {
            _count: { select: { responses: true } },
          },
        },
        surveys: {
          where: { type: SurveyType.POST_EVENT },
          include: {
            _count: { select: { responses: true } },
            criteria: { orderBy: { order: 'asc' } },
          },
        },
        _count: {
          select: {
            participants: {
              where: { status: RegistrationStatus.CONFIRMED },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const eventIds = events.map((event) => event.id);
    const baselineSurveyIds = cycleRecords.map((cycle) => cycle.baselineSurveyId);
    const orphanCycles = cycleRecords.filter(
      (cycle) => !cycle.eventId || !eventIds.includes(cycle.eventId),
    );
    const orphanSurveys = orphanCycles.length
      ? await this.prisma.survey.findMany({
          where: { id: { in: orphanCycles.map((cycle) => cycle.baselineSurveyId) } },
          include: { _count: { select: { responses: true } } },
        })
      : [];
    const cycleSurveyIds = this.unique([
      ...events.flatMap((event) => [
        ...(event.baselineSurveyId ? [event.baselineSurveyId] : []),
        ...event.surveys.map((survey) => survey.id),
      ]),
      ...orphanSurveys.map((survey) => survey.id),
    ]);
    const cycleMetrics = new Map<string, { score: CampusScore; comparison: DashboardResponse['criterionComparison'] }>();
    for (const surveyId of cycleSurveyIds) {
      const aggregate = surveyAggregates?.get(surveyId);
      const main = aggregate?.scoreByCampus.get(Campus.MAIN) ?? null;
      const branch = aggregate?.scoreByCampus.get(Campus.BRANCH) ?? null;
      cycleMetrics.set(surveyId, {
        score: { main, branch, gap: this.gap(main, branch) },
        comparison: aggregate?.criterionComparison ?? [],
      });
    }
    const scoreForSurvey = (surveyId: string): CampusScore =>
      cycleMetrics.get(surveyId)?.score ?? this.emptyCampusScore();
    const comparisonForSurvey = (
      surveyId: string,
    ): DashboardResponse['criterionComparison'] =>
      cycleMetrics.get(surveyId)?.comparison ?? [];
    // Hai phân tích AI của một chu trình:
    //  - bước 02: sau khi kết thúc khảo sát trước (BASELINE)
    //  - bước 05: sau khi kết thúc toàn bộ chu trình (EFFECTIVENESS)
    const analyses = eventIds.length || baselineSurveyIds.length
      ? await this.prisma.aiAnalysis.findMany({
          where: { OR: [{ eventId: { in: eventIds } }, { surveyId: { in: baselineSurveyIds } }] },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const isBaselineStage = (analysis: (typeof analyses)[number]) =>
      analysis.kind === 'BASELINE';
    const isEvaluationStage = (analysis: (typeof analyses)[number]) =>
      analysis.kind === "EFFECTIVENESS";
    const findAnalysis = (
      eventId: string,
      surveyId: string,
      predicate: (analysis: (typeof analyses)[number]) => boolean,
    ) =>
      analyses.find(
        (analysis) => (analysis.eventId === eventId || analysis.surveyId === surveyId) && predicate(analysis),
      ) ?? null;
    const isCompleted = (analysis: { status: string } | null) =>
      analysis?.status === 'COMPLETED' || analysis?.status === 'SUCCESS';

    const cycles: DashboardResponse['cycles'] = [];

    for (const evt of events) {
      const baselineSurvey = evt.baselineSurvey;
      const postSurvey = evt.surveys[0] ?? null;
      // Trạng thái chu kỳ luôn bám theo thời gian thực của sự kiện.
      const eventStatus = deriveEventStatus(evt);
      // AI điểm 1: sau khảo sát trước — nêu vấn đề & đề xuất hoạt động
      const baselineAnalysis = findAnalysis(evt.id, evt.baselineSurveyId, isBaselineStage);
      // AI điểm 2: sau toàn bộ chu trình — đánh giá hiệu quả & đề xuất tiếp theo
      const evaluationAnalysis = findAnalysis(evt.id, evt.baselineSurveyId, isEvaluationStage);
      const baselineOutput = this.asRecord(baselineAnalysis?.output);
      const evaluationOutput = this.asRecord(evaluationAnalysis?.output);

      const baselineResponsesCount = baselineSurvey?._count.responses ?? 0;
      const postResponsesCount = postSurvey?._count.responses ?? 0;
      const participantsCount = evt._count.participants;

      // Bước 1: Khảo sát ban đầu
      const step1Status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' =
        baselineResponsesCount > 0
          ? 'COMPLETED'
          : baselineSurvey?.published
            ? 'IN_PROGRESS'
            : 'WAITING';

      // Bước 2: Phân tích AI thực trạng (ngay sau khảo sát trước)
      const step2Status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' = isCompleted(
        baselineAnalysis,
      )
        ? 'COMPLETED'
        : baselineAnalysis?.status === 'PENDING' || baselineResponsesCount > 0
          ? 'IN_PROGRESS'
          : 'WAITING';

      // Bước 3: Tổ chức sự kiện
      const step3Status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' =
        eventStatus === 'COMPLETED'
          ? 'COMPLETED'
          : eventStatus === 'LIVE'
            ? 'IN_PROGRESS'
            : 'WAITING';

      // Bước 4: Khảo sát sau sự kiện
      const step4Status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' =
        postResponsesCount > 0
          ? 'COMPLETED'
          : postSurvey?.published
            ? 'IN_PROGRESS'
            : 'WAITING';

      // Bước 5: AI đánh giá hiệu quả & đề xuất chu kỳ tiếp theo.
      // Chạy được ngay khi cả khảo sát trước và khảo sát sau đều có ≥ 1 phản hồi.
      const canEvaluate = postResponsesCount > 0;
      const step5Status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' = isCompleted(
        evaluationAnalysis,
      )
        ? 'COMPLETED'
        : evaluationAnalysis?.status === 'PENDING' || canEvaluate
          ? 'IN_PROGRESS'
          : 'WAITING';

      // Xác định currentStep (1..5)
      let currentStep = 1;
      if (step1Status === 'COMPLETED') currentStep = 2;
      if (step2Status === 'COMPLETED') currentStep = 3;
      if (step3Status === 'COMPLETED') currentStep = 4;
      if (step4Status === 'COMPLETED') currentStep = 5;

      // Tính điểm trước & sau
      let beforeScore: CampusScore = { main: null, branch: null, gap: null };
      if (baselineSurvey) {
        beforeScore = scoreForSurvey(baselineSurvey.id);
      }

      let afterScore: CampusScore = { main: null, branch: null, gap: null };
      let afterByCriterion: DashboardResponse['cycles'][number]['metrics']['afterByCriterion'] = [];
      if (postSurvey) {
        const postMetrics = cycleMetrics.get(postSurvey.id);
        afterScore = postMetrics?.score ?? this.emptyCampusScore();
        const afterComparison = comparisonForSurvey(postSurvey.id);
        afterByCriterion = postSurvey.criteria.map((criterion) =>
          afterComparison.find((item) => item.criterionId === criterion.id) ?? {
            criterionId: criterion.id,
            criterionName: criterion.name,
            mainScore: null,
            branchScore: null,
            gap: null,
            responseCount: { MAIN: 0, BRANCH: 0 },
          },
        );
      }

      const gapBefore = beforeScore.gap;
      const gapAfter = afterScore.gap;
      const gapChange =
        gapBefore !== null && gapAfter !== null
          ? this.round(gapAfter - gapBefore)
          : null;

      const readRecommendations = (
        output: Prisma.JsonValue | null | undefined,
      ) => {
        const recommendations = this.asRecord(output).recommendations;
        return Array.isArray(recommendations)
          ? recommendations.filter(
              (item): item is string => typeof item === 'string',
            )
          : [];
      };
      const baselineRecommendations = readRecommendations(
        baselineAnalysis?.output,
      );
      const evaluationRecommendations = readRecommendations(
        evaluationAnalysis?.output,
      );

      cycles.push({
        id: cycleByEvent.get(evt.id)?.id ?? evt.id,
        eventId: evt.id,
        baselineSurveyId: evt.baselineSurveyId,
        title: cycleByEvent.get(evt.id)?.title ?? evt.title,
        status: eventStatus,
        startAt: evt.startAt.toISOString(),
        endAt: evt.endAt.toISOString(),
        currentStep,
        steps: {
          step1: {
            name: '01. Khảo sát đầu vào',
            status: step1Status,
            surveyId: baselineSurvey?.id ?? '',
            surveyTitle: baselineSurvey?.title ?? 'Chưa gắn khảo sát',
            responsesCount: baselineResponsesCount,
          },
          step2: {
            name: '02. Phân tích AI thực trạng',
            status: step2Status,
            analysisId: baselineAnalysis?.id ?? null,
            summary:
              typeof baselineOutput.summary === 'string'
                ? baselineOutput.summary
                : null,
            recommendations: baselineRecommendations,
            recommendationsCount: baselineRecommendations.length,
            updatedAt: baselineAnalysis?.updatedAt.toISOString() ?? null,
          },
          step3: {
            name: '03. Tổ chức hoạt động',
            status: step3Status,
            eventId: evt.id,
            eventTitle: evt.title,
            coverImageUrl: evt.coverImageUrl,
            participantsCount,
          },
          step4: {
            name: '04. Khảo sát mức độ hài lòng',
            status: step4Status,
            surveyId: postSurvey?.id ?? null,
            surveyTitle: postSurvey?.title ?? null,
            responsesCount: postResponsesCount,
          },
          step5: {
            name: '05. AI tổng kết và gợi ý lần sau',
            status: step5Status,
            analysisId: evaluationAnalysis?.id ?? null,
            summary:
              typeof evaluationOutput.summary === 'string'
                ? evaluationOutput.summary
                : null,
            recommendationsCount: evaluationRecommendations.length,
            updatedAt: evaluationAnalysis?.updatedAt.toISOString() ?? null,
          },
        },
        metrics: {
          beforeScore,
          afterScore,
          afterByCriterion,
          gapChange,
          aiEvaluation: {
            analysisId: evaluationAnalysis?.id ?? null,
            status: evaluationAnalysis?.status ?? null,
            updatedAt: evaluationAnalysis?.updatedAt.toISOString() ?? null,
            summary:
              typeof evaluationOutput.summary === 'string'
                ? evaluationOutput.summary
                : null,
            recommendations: evaluationRecommendations,
          },
        },
      });
    }

    const orphanSurveyById = new Map(orphanSurveys.map((survey) => [survey.id, survey]));
    for (const cycle of orphanCycles) {
      const survey = orphanSurveyById.get(cycle.baselineSurveyId);
      if (!survey) continue;
      const analysis = analyses.find((item) => item.surveyId === survey.id && isBaselineStage(item)) ?? null;
      const output = this.asRecord(analysis?.output);
      const recommendations = Array.isArray(output.recommendations)
        ? output.recommendations.filter((item): item is string => typeof item === 'string')
        : [];
      const count = survey._count.responses;
      const completed = analysis?.status === 'COMPLETED' || analysis?.status === 'SUCCESS';
      cycles.push({
        id: cycle.id,
        eventId: null,
        baselineSurveyId: survey.id,
        title: cycle.title,
        status: 'DRAFT',
        startAt: cycle.createdAt.toISOString(),
        endAt: cycle.createdAt.toISOString(),
        currentStep: count ? (completed ? 3 : 2) : 1,
        steps: {
          step1: { name: '01. Khảo sát đầu vào', status: count ? 'COMPLETED' : 'IN_PROGRESS', surveyId: survey.id, surveyTitle: survey.title, responsesCount: count },
          step2: { name: '02. AI phân tích thực trạng', status: completed ? 'COMPLETED' : analysis?.status === 'PENDING' || count ? 'IN_PROGRESS' : 'WAITING', analysisId: analysis?.id ?? null, summary: typeof output.summary === 'string' ? output.summary : null, recommendations, recommendationsCount: recommendations.length, updatedAt: analysis?.updatedAt.toISOString() ?? null },
          step3: { name: '03. Tổ chức sự kiện', status: 'WAITING', eventId: null, eventTitle: cycle.title, coverImageUrl: null, participantsCount: 0 },
          step4: { name: '04. Khảo sát hài lòng', status: 'WAITING', surveyId: null, surveyTitle: null, responsesCount: 0 },
          step5: { name: '05. AI tổng kết', status: 'WAITING', analysisId: null, summary: null, recommendationsCount: 0, updatedAt: null },
        },
        metrics: {
          beforeScore: scoreForSurvey(survey.id),
          afterScore: this.emptyCampusScore(),
          afterByCriterion: [],
          gapChange: null,
          aiEvaluation: { analysisId: null, status: null, updatedAt: null, summary: null, recommendations: [] },
        },
      });
    }
    cycles.sort((a, b) => b.startAt.localeCompare(a.startAt));
    return cycles;
  }

  private async getResponses(
    surveyIds: string[],
  ): Promise<ResponseWithAnswers[]> {
    if (surveyIds.length === 0) return [];
    return this.prisma.response.findMany({
      where: { surveyId: { in: surveyIds } },
      select: {
        id: true,
        surveyId: true,
        studentId: true,
        student: { select: { campus: true } },
        answers: {
          select: {
            questionId: true,
            value: true,
            question: {
              select: {
                id: true,
                prompt: true,
                type: true,
                criterionId: true,
                criterion: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  async recalculateEvent(eventId: string, user: AuthenticatedUser) {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Chỉ giáo viên mới có thể tính lại điểm');
    }
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, teacherId: user.id },
      include: {
        baselineSurvey: true,
        surveys: { where: { type: SurveyType.POST_EVENT } },
      },
    });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện');

    const surveys = [event.baselineSurvey, ...event.surveys];
    const results = [];
    for (const survey of surveys) {
      results.push(await this.recalculateSurvey(survey.id));
    }
    return {
      eventId,
      calculationVersion: CALCULATION_VERSION,
      scores: results,
    };
  }

  private async recalculateSurvey(surveyId: string) {
    const responses = await this.getResponses([surveyId]);
    const scores = calculateCampusScores(responses);
    const result = [];

    for (const campus of [Campus.MAIN, Campus.BRANCH]) {
      const responseCount = responses.filter(
        (response) =>
          response.student.campus === campus &&
          response.answers.some(
            (answer) =>
              answer.question.type === QuestionType.RATING &&
              this.toScore(answer.value, answer.question.type) !== null,
          ),
      ).length;
      const score = scores.overall.get(campus) ?? null;
      result.push(
        await this.prisma.satisfactionScore.upsert({
          where: { surveyId_campus: { surveyId, campus } },
          create: {
            surveyId,
            eventId: (
              await this.prisma.survey.findUniqueOrThrow({
                where: { id: surveyId },
                select: { eventId: true },
              })
            ).eventId,
            campus,
            score,
            responseCount,
            calculationVersion: CALCULATION_VERSION,
          },
          update: {
            score,
            responseCount,
            calculationVersion: CALCULATION_VERSION,
            calculatedAt: new Date(),
          },
        }),
      );
    }
    return result;
  }

  async createAnalysis(filters: DashboardFilters, user: AuthenticatedUser) {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException(
        'Chỉ giáo viên mới có thể chạy phân tích AI',
      );
    }
    // Dashboard OVERVIEW is independent of the two cycle-specific AI stages.
    const kind = resolveAnalysisKind(filters.kind, Boolean(filters.eventId));
    if (
      kind === 'OVERVIEW' &&
      (filters.eventId || filters.surveyId || filters.surveyType)
    ) {
      throw new BadRequestException(
        'Phân tích tổng quan chỉ chạy từ toàn bộ khảo sát đã công bố trên dashboard',
      );
    }
    if (kind === 'EFFECTIVENESS' && !filters.eventId) {
      throw new BadRequestException(
        'Đánh giá hiệu quả chỉ chạy cho một chu kỳ sự kiện',
      );
    }
    if (kind === 'EFFECTIVENESS') {
      const event = await this.prisma.event.findFirst({
        where: { id: filters.eventId, teacherId: user.id },
        select: {
          status: true,
          startAt: true,
          endAt: true,
          baselineSurvey: { select: { _count: { select: { responses: true } } } },
          surveys: {
            where: { type: SurveyType.POST_EVENT },
            select: { _count: { select: { responses: true } } },
          },
        },
      });
      if (!event) throw new NotFoundException('Không tìm thấy sự kiện');
      const afterResponses = event.surveys.reduce(
        (total, survey) => total + survey._count.responses,
        0,
      );
      // AI tổng kết dựa trên khảo sát hài lòng sau hoạt động; khảo sát trước chỉ ghi nhận mong muốn.
      if (!event.surveys.length) {
        throw new BadRequestException(
          'Chu kỳ cần có khảo sát sau sự kiện để đánh giá',
        );
      }
      if (afterResponses < 1) {
        throw new BadRequestException(
          'Cần ít nhất 1 phản hồi khảo sát sau sự kiện trước khi đánh giá',
        );
      }
    }
    const surveyIds = await this.getAnalysisSurveyIds(
      { ...filters, kind },
      user.id,
      kind,
    );
    if (!surveyIds.length) {
      throw new BadRequestException(
        kind === 'OVERVIEW'
          ? 'Chưa có khảo sát đã công bố để phân tích tổng quan'
          : kind === 'BASELINE'
            ? 'Chưa có khảo sát trước phù hợp để phân tích'
            : 'Chưa có đủ khảo sát trước – sau để đánh giá hiệu quả',
      );
    }
    return this.runAnalysis(
      surveyIds,
      filters.eventId,
      user.id,
      undefined,
      kind,
    );
  }

  async getSurveyAnalysis(
    surveyId: string,
    user: AuthenticatedUser,
    eventId?: string,
    kind?: AnalysisKind,
  ) {
    // Khi xem từ chu kỳ sự kiện: phân tích theo eventId (BASELINE = lần 1,
    // EFFECTIVENESS = lần 2), đồng bộ đúng logic với trang chi tiết chu kỳ.
    if (eventId) {
      const analysisKind = resolveAnalysisKind(kind, true);
      const event = await this.prisma.event.findFirst({
        where: { id: eventId, teacherId: user.id },
        select: { id: true, baselineSurveyId: true },
      });
      if (!event) throw new NotFoundException('Không tìm thấy sự kiện');
      const analysis = await this.prisma.aiAnalysis.findFirst({
        where: {
          ...(analysisKind === 'BASELINE'
            ? { OR: [{ eventId }, { surveyId: event.baselineSurveyId }] }
            : { eventId }),
          authorId: user.id,
          kind: analysisKind,
        },
        orderBy: { createdAt: 'desc' },
      });
      const output = this.asRecord(analysis?.output);
      const recommendations = Array.isArray(output.recommendations)
        ? output.recommendations.filter(
            (item): item is string => typeof item === 'string',
          )
        : [];
      return {
        analysisId: analysis?.id ?? null,
        status: analysis?.status ?? null,
        title: typeof output.title === 'string' ? output.title : null,
        summary: typeof output.summary === 'string' ? output.summary : null,
        recommendations,
        updatedAt: analysis?.updatedAt.toISOString() ?? null,
        canRetry: analysis?.status === 'FAILED',
        alreadyLinkedToEvent: true,
      };
    }
    if (!surveyId)
      throw new BadRequestException('Cần chọn khảo sát để xem phân tích AI');
    const survey = await this.prisma.survey.findFirst({
      where: {
        id: surveyId,
        teacherId: user.id,
        type: SurveyType.BASELINE,
      },
      select: { id: true },
    });
    if (!survey) throw new NotFoundException('Không tìm thấy khảo sát thực trạng');

    const [analysis, linkedEvent] = await Promise.all([
      this.prisma.aiAnalysis.findFirst({
        where: { surveyId, authorId: user.id, kind: 'BASELINE' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.event.findFirst({
        where: { baselineSurveyId: survey.id },
        select: { id: true },
      }),
    ]);
    const output = this.asRecord(analysis?.output);
    const recommendations = Array.isArray(output.recommendations)
      ? output.recommendations.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    return {
      analysisId: analysis?.id ?? null,
      status: analysis?.status ?? null,
      title: typeof output.title === 'string' ? output.title : null,
      summary: typeof output.summary === 'string' ? output.summary : null,
      recommendations,
      updatedAt: analysis?.updatedAt.toISOString() ?? null,
      canRetry: analysis?.status === 'FAILED',
      alreadyLinkedToEvent: Boolean(linkedEvent),
    };
  }

  async retryAnalysis(id: string, user: AuthenticatedUser) {
    const analysis = await this.prisma.aiAnalysis.findFirst({
      where: { id, authorId: user.id, status: 'FAILED' },
    });
    if (!analysis) {
      throw new NotFoundException('Không tìm thấy phân tích AI cần chạy lại');
    }
    const kind = resolveAnalysisKind(
      isAnalysisKind(analysis.kind) ? analysis.kind : undefined,
      Boolean(analysis.eventId),
    );
    const surveyIds =
      kind === 'OVERVIEW' || (kind === 'EFFECTIVENESS' && analysis.eventId)
        ? await this.getAnalysisSurveyIds(
            { eventId: analysis.eventId ?? undefined, kind },
            user.id,
            kind,
          )
        : analysis.surveyId
          ? [analysis.surveyId]
          : [];
    return this.runAnalysis(
      surveyIds,
      analysis.eventId ?? undefined,
      user.id,
      id,
      kind,
    );
  }

  private async getAnalysisSurveyIds(
    filters: DashboardFilters,
    teacherId: string,
    kind: AnalysisKind,
  ) {
    if (kind === 'OVERVIEW') {
      const surveys = await this.prisma.survey.findMany({
        where: { published: true },
        select: { id: true },
      });
      return surveys.map((survey) => survey.id);
    }
    if (filters.eventId) {
      const event = await this.prisma.event.findFirst({
        where: { id: filters.eventId, teacherId },
        select: {
          baselineSurveyId: true,
          surveys: {
            where: { type: SurveyType.POST_EVENT },
            select: { id: true },
          },
        },
      });
      if (!event) return [];
      // Bước 02: chỉ phân tích khảo sát trước.
      if (kind === 'BASELINE') return [event.baselineSurveyId];
      // Bước 05 chỉ đánh giá dữ liệu hài lòng sau sự kiện; baseline là mong muốn dạng lựa chọn.
      return event.surveys.map((survey) => survey.id);
    }
    const surveys = await this.prisma.survey.findMany({
      where: {
        teacherId,
        ...(filters.surveyId ? { id: filters.surveyId } : {}),
        ...(filters.surveyType ? { type: filters.surveyType } : {}),
        ...(kind === 'BASELINE' ? { type: SurveyType.BASELINE } : {}),
      },
      select: { id: true },
    });
    return surveys.map((survey) => survey.id);
  }

  private async runAnalysis(
    surveyIds: string[],
    eventId: string | undefined,
    authorId: string,
    existingId?: string,
    kind?: AnalysisKind,
  ) {
    const analysisKind: AnalysisKind = resolveAnalysisKind(
      kind,
      Boolean(eventId),
    );
    const responses = await this.getResponses(surveyIds);
    if (!responses.length) {
      throw new BadRequestException(
        analysisKind === 'OVERVIEW'
          ? 'Chưa có phản hồi khảo sát đã công bố để phân tích tổng quan'
          : analysisKind === 'BASELINE'
            ? 'Chưa có phản hồi khảo sát trước để phân tích'
            : 'Chưa có đủ dữ liệu trước – sau để đánh giá hiệu quả',
      );
    }
    const inputAggregate = await this.buildAnalysisInput(
      responses,
      surveyIds,
      analysisKind,
    );
    const analysis = existingId
      ? await this.prisma.aiAnalysis.update({
          where: { id: existingId },
          data: {
            status: 'PENDING',
            kind: analysisKind,
            inputAggregate,
            attemptCount: { increment: 1 },
            lastError: null,
            completedAt: null,
          },
        })
      : await this.prisma.aiAnalysis.create({
          data: {
            surveyId: surveyIds.length === 1 ? surveyIds[0] : null,
            eventId: eventId ?? null,
            authorId,
            kind: analysisKind,
            status: 'PENDING',
            inputAggregate,
            attemptCount: 1,
            promptVersion: 'one-school-analysis-v2',
          },
        });

    try {
      const output = await this.callAi(inputAggregate, analysisKind);
      return this.prisma.aiAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: 'COMPLETED',
          output,
          model: this.config.get<string>('AI_MODEL'),
          completedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI provider error';
      await this.prisma.aiAnalysis.update({
        where: { id: analysis.id },
        data: { status: 'FAILED', lastError: message },
      });
      throw new BadGatewayException(
        'Phân tích AI thất bại. Vui lòng thử lại sau.',
      );
    }
  }

  private buildAiAggregate(responses: ResponseWithAnswers[]) {
    const scores = calculateCampusScores(responses);
    const criterionNames = new Map<string, string>();
    const questions = new Map<
      string,
      {
        title: string;
        type: QuestionType;
        criterionName: string;
        byCampus: Map<Campus, Map<string, number>>;
        responseCounts: Record<Campus, number>;
      }
    >();
    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;
      for (const answer of response.answers) {
        if (answer.question.type === QuestionType.OPEN_TEXT) continue;
        const criterion = answer.question.criterion;
        criterionNames.set(criterion.id, criterion.name);
        const question = questions.get(answer.questionId) ?? {
          title: answer.question.prompt,
          type: answer.question.type,
          criterionName: criterion.name,
          byCampus: new Map<Campus, Map<string, number>>(),
          responseCounts: { [Campus.MAIN]: 0, [Campus.BRANCH]: 0 },
        };
        question.responseCounts[campus] += 1;

        const labels =
          answer.question.type === QuestionType.MULTIPLE_CHOICE &&
          Array.isArray(answer.value)
            ? answer.value.filter(
                (value): value is string => typeof value === 'string',
              )
            : [this.answerLabel(answer.value)];
        const distribution =
          question.byCampus.get(campus) ?? new Map<string, number>();
        for (const label of labels) {
          distribution.set(label, (distribution.get(label) ?? 0) + 1);
        }
        question.byCampus.set(campus, distribution);
        questions.set(answer.questionId, question);
      }
    }
    const criteria = [...scores.criteria.entries()].map(
      ([criterionId, campuses]) => ({
        criterionId,
        criterionName: criterionNames.get(criterionId) ?? 'Tiêu chí',
        main: campuses.get(Campus.MAIN)?.score ?? null,
        branch: campuses.get(Campus.BRANCH)?.score ?? null,
        mainResponseCount: campuses.get(Campus.MAIN)?.responseCount ?? 0,
        branchResponseCount: campuses.get(Campus.BRANCH)?.responseCount ?? 0,
      }),
    );
    return {
      calculationVersion: CALCULATION_VERSION,
      responseCount: responses.length,
      questionStatistics: [...questions.entries()].map(
        ([questionId, question]) => ({
          questionId,
          question: question.title,
          type: question.type,
          criterionName: question.criterionName,
          responseCount: question.responseCounts,
          MAIN: [
            ...(question.byCampus.get(Campus.MAIN) ?? new Map()).entries(),
          ].map(([option, count]) => ({ option, count })),
          BRANCH: [
            ...(question.byCampus.get(Campus.BRANCH) ?? new Map()).entries(),
          ].map(([option, count]) => ({ option, count })),
        }),
      ),
      scores: {
        MAIN: scores.overall.get(Campus.MAIN) ?? null,
        BRANCH: scores.overall.get(Campus.BRANCH) ?? null,
      },
      criteria,
    };
  }

  /**
   * Dữ liệu đưa vào LLM theo từng ngữ cảnh AI:
   *  - OVERVIEW: bảng so sánh tiêu chí mà dashboard sử dụng.
   *  - BASELINE: aggregate của khảo sát trước (thực trạng).
   *  - EFFECTIVENESS: tách riêng aggregate trước/sau + bảng so sánh điểm.
   */
  private async buildAnalysisInput(
    responses: ResponseWithAnswers[],
    surveyIds: string[],
    kind: AnalysisKind,
  ): Promise<Prisma.InputJsonValue> {
    if (kind === 'OVERVIEW') {
      const campusComparisonByCriterion =
        this.buildAllSurveysCriterionComparisonFromResponses(responses);
      if (!campusComparisonByCriterion.length) {
        throw new BadRequestException(
          'Chưa có dữ liệu điểm theo tiêu chí từ các khảo sát đã công bố để phân tích tổng quan',
        );
      }
      return {
        calculationVersion: CALCULATION_VERSION,
        stage: 'OVERVIEW',
        responseCount: responses.length,
        campusComparisonByCriterion,
      };
    }
    if (kind !== 'EFFECTIVENESS') {
      const survey = await this.prisma.survey.findUnique({
        where: { id: surveyIds[0] },
        select: { title: true },
      });
      return {
        stage: 'BASELINE_PREFERENCES',
        programTitle: survey?.title?.split(':').slice(1).join(':').trim() ?? null,
        responseCount: responses.length,
        questions: this.buildAiAggregate(responses).questionStatistics.map(
          ({ question, type, responseCount, MAIN, BRANCH }) => ({
            question,
            type,
            responseCount,
            MAIN,
            BRANCH,
          }),
        ),
      };
    }

    const surveys = await this.prisma.survey.findMany({
      where: { id: { in: surveyIds } },
      select: { id: true, type: true, title: true },
    });
    const afterIds = surveys
      .filter((survey) => survey.type === SurveyType.POST_EVENT)
      .map((survey) => survey.id);
    const afterResponses = responses.filter((response) =>
      afterIds.includes(response.surveyId),
    );
    if (!afterResponses.length) {
      throw new BadRequestException(
        'Cần ít nhất một phản hồi khảo sát sau sự kiện để đánh giá',
      );
    }
    const afterScores = this.buildScores(afterResponses);
    const after = this.averageScores(afterScores);
    const afterComparison = this.buildCriterionComparison(
      afterResponses,
      afterScores,
    );
    const survey = await this.prisma.survey.findUnique({
      where: { id: afterIds[0] },
      select: {
        title: true,
        criteria: { select: { id: true, name: true, order: true } },
      },
    });
    const criterionScores = (survey?.criteria ?? []).map((criterion) =>
      afterComparison.find((item) => item.criterionId === criterion.id) ?? {
        criterionId: criterion.id,
        criterionName: criterion.name,
        mainScore: null,
        branchScore: null,
        gap: null,
        responseCount: { MAIN: 0, BRANCH: 0 },
      },
    );
    return {
      calculationVersion: CALCULATION_VERSION,
      stage: 'POST_EVENT_EVALUATION',
      programTitle: survey?.title?.split(':').slice(1).join(':').trim() ?? null,
      responseCount: afterResponses.length,
      overallSatisfaction: after,
      criteria: criterionScores.map((criterion) => ({
        criterionName: criterion.criterionName,
        mainScore: criterion.mainScore,
        branchScore: criterion.branchScore,
        gap: criterion.gap,
        responseCount: criterion.responseCount,
      })),
      questionStatistics: this.buildAiAggregate(afterResponses).questionStatistics,
      criterionScores,
    };
  }

  private async callAi(
    inputAggregate: Prisma.InputJsonValue,
    kind: AnalysisKind,
  ) {
    const apiKey = this.config.get<string>('AI_API_KEY');
    const baseUrl = this.config.get<string>('AI_API_BASE_URL');
    const model = this.config.get<string>('AI_MODEL');
    if (!apiKey || !baseUrl || !model) {
      throw new Error('AI provider chưa được cấu hình');
    }
    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: analysisSystemPrompt(kind),
            },
            {
              role: 'user',
              content: JSON.stringify(
                typeof inputAggregate === 'object' &&
                  inputAggregate !== null &&
                  !Array.isArray(inputAggregate)
                  ? { analysisStage: kind, ...inputAggregate }
                  : { analysisStage: kind, data: inputAggregate },
              ),
            },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) throw new Error(`AI provider HTTP ${response.status}`);
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI provider trả về kết quả rỗng');
    const parsed: unknown = JSON.parse(content);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as { title?: unknown }).title !== 'string' ||
      typeof (parsed as { summary?: unknown }).summary !== 'string' ||
      !Array.isArray(
        (parsed as { recommendations?: unknown }).recommendations,
      ) ||
      !(parsed as { recommendations: unknown[] }).recommendations.every(
        (item) => typeof item === 'string',
      )
    ) {
      throw new Error('AI provider trả về sai cấu trúc');
    }
    return parsed as Prisma.InputJsonValue;
  }

  private buildScores(responses: ResponseWithAnswers[]): ScoreMap {
    const values = new Map<string, Map<Campus, number[]>>();
    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;
      const criterionValues = new Map<string, number[]>();
      for (const answer of response.answers) {
        const score = this.toScore(answer.value, answer.question.type);
        if (score === null) continue;
        const current = criterionValues.get(answer.question.criterionId) ?? [];
        current.push(score);
        criterionValues.set(answer.question.criterionId, current);
      }
      for (const [criterionId, criterionScores] of criterionValues) {
        const current = values.get(criterionId) ?? new Map<Campus, number[]>();
        const campusScores = current.get(campus) ?? [];
        campusScores.push(this.average(criterionScores));
        current.set(campus, campusScores);
        values.set(criterionId, current);
      }
    }

    const scores: ScoreMap = new Map();
    for (const [criterionId, campusValues] of values) {
      const result = new Map<Campus, number>();
      for (const [campus, campusScores] of campusValues) {
        result.set(campus, this.round(this.average(campusScores)));
      }
      scores.set(criterionId, result);
    }
    return scores;
  }

  private buildCriterionComparison(
    responses: ResponseWithAnswers[],
    scores: ScoreMap,
  ): DashboardResponse['criterionComparison'] {
    const criteria = new Map<string, string>();
    const responseCounts = new Map<string, Map<Campus, Set<string>>>();
    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;
      for (const answer of response.answers) {
        const criterion = answer.question.criterion;
        criteria.set(criterion.id, criterion.name);
        const counts =
          responseCounts.get(criterion.id) ?? new Map<Campus, Set<string>>();
        const studentIds = counts.get(campus) ?? new Set<string>();
        studentIds.add(response.studentId);
        counts.set(campus, studentIds);
        responseCounts.set(criterion.id, counts);
      }
    }
    return [...criteria.entries()].map(([criterionId, criterionName]) => {
      const campusScores = scores.get(criterionId) ?? new Map<Campus, number>();
      const mainScore = campusScores.get(Campus.MAIN) ?? null;
      const branchScore = campusScores.get(Campus.BRANCH) ?? null;
      return {
        criterionId,
        criterionName,
        mainScore,
        branchScore,
        gap: this.gap(mainScore, branchScore),
        responseCount: {
          MAIN: responseCounts.get(criterionId)?.get(Campus.MAIN)?.size ?? 0,
          BRANCH:
            responseCounts.get(criterionId)?.get(Campus.BRANCH)?.size ?? 0,
        },
      };
    });
  }

  private buildQuestionBreakdown(
    responses: ResponseWithAnswers[],
  ): DashboardResponse['questionBreakdown'] {
    const questions = new Map<
      string,
      {
        text: string;
        criterionName: string;
        values: Map<Campus, Map<string, number>>;
      }
    >();
    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;
      for (const answer of response.answers) {
        const question = questions.get(answer.questionId) ?? {
          text: answer.question.prompt,
          criterionName: answer.question.criterion.name,
          values: new Map<Campus, Map<string, number>>(),
        };
        const distribution =
          question.values.get(campus) ?? new Map<string, number>();
        const label = this.answerLabel(answer.value);
        distribution.set(label, (distribution.get(label) ?? 0) + 1);
        question.values.set(campus, distribution);
        questions.set(answer.questionId, question);
      }
    }
    return [...questions.entries()].map(([questionId, question]) => ({
      questionId,
      questionText: question.text,
      criterionName: question.criterionName,
      mainDistribution: this.toDistribution(question.values.get(Campus.MAIN)),
      branchDistribution: this.toDistribution(
        question.values.get(Campus.BRANCH),
      ),
    }));
  }

  private async getAiInsight(
    authorId?: string,
  ): Promise<DashboardResponse['aiInsight']> {
    const analysis = await this.prisma.aiAnalysis.findFirst({
      where: {
        kind: 'OVERVIEW',
        ...(authorId ? { authorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    const output = this.asRecord(analysis?.output);
    const recommendations = Array.isArray(output.recommendations)
      ? output.recommendations.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    return {
      analysisId: analysis?.id ?? null,
      status: analysis?.status ?? null,
      kind: analysis && isAnalysisKind(analysis.kind) ? analysis.kind : null,
      title: typeof output.title === 'string' ? output.title : null,
      summary: typeof output.summary === 'string' ? output.summary : null,
      recommendations,
      updatedAt: analysis?.updatedAt.toISOString() ?? null,
      canRetry: analysis?.status === 'FAILED',
    };
  }

  private async getEffectiveness(
    eventId?: string,
  ): Promise<DashboardResponse['effectiveness']> {
    if (!eventId) return this.emptyEffectiveness();
    const surveys = await this.prisma.survey.findMany({
      where: {
        OR: [
          { eventId: null, type: SurveyType.BASELINE },
          { eventId, type: SurveyType.POST_EVENT },
        ],
      },
    });
    const beforeSurvey = surveys.find(
      (survey) => survey.type === SurveyType.BASELINE,
    );
    const afterSurvey = surveys.find(
      (survey) => survey.type === SurveyType.POST_EVENT,
    );
    if (!beforeSurvey || !afterSurvey) return this.emptyEffectiveness();
    const [before, after] = await Promise.all([
      this.averageForSurvey(beforeSurvey.id),
      this.averageForSurvey(afterSurvey.id),
    ]);
    return {
      available:
        before.main !== null ||
        before.branch !== null ||
        after.main !== null ||
        after.branch !== null,
      before,
      after,
      byCriterion: await this.getCriterionEffectiveness(
        beforeSurvey.id,
        afterSurvey.id,
      ),
      changeByCampus: {
        main: this.change(before.main, after.main),
        branch: this.change(before.branch, after.branch),
        gap: this.gap(after.main, after.branch),
      },
    };
  }

  private async averageForSurvey(surveyId: string): Promise<CampusScore> {
    const responses = await this.getResponses([surveyId]);
    const scores = this.averageScores(this.buildScores(responses));
    return { ...scores, gap: this.gap(scores.main, scores.branch) };
  }

  private async getCriterionEffectiveness(
    beforeSurveyId: string,
    afterSurveyId: string,
  ): Promise<DashboardResponse['effectiveness']['byCriterion']> {
    const [beforeResponses, afterResponses] = await Promise.all([
      this.getResponses([beforeSurveyId]),
      this.getResponses([afterSurveyId]),
    ]);
    const before = this.buildNamedScores(beforeResponses);
    const after = this.buildNamedScores(afterResponses);
    const names = this.unique([...before.keys(), ...after.keys()]);
    return names.map((criterionName) => {
      const beforeScore = before.get(criterionName) ?? this.emptyCampusScore();
      const afterScore = after.get(criterionName) ?? this.emptyCampusScore();
      return {
        criterionName,
        before: beforeScore,
        after: afterScore,
        changeByCampus: {
          main: this.change(beforeScore.main, afterScore.main),
          branch: this.change(beforeScore.branch, afterScore.branch),
          gap: this.change(beforeScore.gap, afterScore.gap),
        },
      };
    });
  }

  private buildNamedScores(
    responses: ResponseWithAnswers[],
  ): Map<string, CampusScore> {
    const values = new Map<string, Map<Campus, number[]>>();
    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;
      for (const answer of response.answers) {
        const score = this.toScore(answer.value, answer.question.type);
        if (score === null) continue;
        const criterionName = answer.question.criterion.name;
        const campusValues =
          values.get(criterionName) ?? new Map<Campus, number[]>();
        const scores = campusValues.get(campus) ?? [];
        scores.push(score);
        campusValues.set(campus, scores);
        values.set(criterionName, campusValues);
      }
    }
    return new Map(
      [...values.entries()].map(([name, campusValues]) => {
        const main = campusValues.get(Campus.MAIN);
        const branch = campusValues.get(Campus.BRANCH);
        const mainScore = main?.length ? this.round(this.average(main)) : null;
        const branchScore = branch?.length
          ? this.round(this.average(branch))
          : null;
        return [
          name,
          {
            main: mainScore,
            branch: branchScore,
            gap: this.gap(mainScore, branchScore),
          },
        ];
      }),
    );
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

  private async countParticipants(eventIds: string[]) {
    if (!eventIds.length) return { main: 0, branch: 0 };
    const participants = await this.prisma.eventParticipant.findMany({
      where: {
        eventId: { in: eventIds },
        status: RegistrationStatus.CONFIRMED,
      },
      select: { student: { select: { campus: true } } },
    });
    return {
      main: participants.filter((item) => item.student.campus === Campus.MAIN)
        .length,
      branch: participants.filter(
        (item) => item.student.campus === Campus.BRANCH,
      ).length,
    };
  }

  private async countEvents(eventIds: string[]) {
    if (eventIds.length) return eventIds.length;
    return this.prisma.event.count({ where: { status: { not: 'DRAFT' } } });
  }

  private countDistinctRespondents(responses: ResponseWithAnswers[]) {
    const result = new Map<Campus, Set<string>>();
    for (const response of responses) {
      if (!response.student.campus) continue;
      const ids = result.get(response.student.campus) ?? new Set<string>();
      ids.add(response.studentId);
      result.set(response.student.campus, ids);
    }
    return new Map([...result].map(([campus, ids]) => [campus, ids.size]));
  }

  private averageScores(scores: ScoreMap): CampusScore {
    const averageCampus = (campus: Campus) => {
      const values = [...scores.values()]
        .map((criterionScores) => criterionScores.get(campus))
        .filter((value): value is number => this.isNumber(value));
      return values.length ? this.round(this.average(values)) : null;
    };
    const mainScore = averageCampus(Campus.MAIN);
    const branchScore = averageCampus(Campus.BRANCH);
    return {
      main: mainScore,
      branch: branchScore,
      gap: this.gap(mainScore, branchScore),
    };
  }

  private toScore(value: Prisma.JsonValue, type: QuestionType): number | null {
    if (type !== QuestionType.RATING) return null;
    if (typeof value === 'number' && value >= 1 && value <= 5)
      return ((value - 1) / 4) * 100;
    return null;
  }

  private answerLabel(value: Prisma.JsonValue): string {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    return 'Khác';
  }

  private toDistribution(values?: Map<string, number>) {
    return [...(values ?? new Map<string, number>())].map(([label, count]) => ({
      label,
      count,
    }));
  }

  private asRecord(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, Prisma.JsonValue> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, Prisma.JsonValue>)
      : {};
  }

  private rate(numerator: number, denominator: number): number | null {
    return denominator ? this.round((numerator / denominator) * 100) : null;
  }

  private average(values: number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private averageNullable(...values: Array<number | null>) {
    const numbers = values.filter((value) => this.isNumber(value));
    return numbers.length ? this.round(this.average(numbers)) : null;
  }

  private gap(main: number | null, branch: number | null) {
    return main !== null && branch !== null ? this.round(main - branch) : null;
  }

  private change(before: number | null, after: number | null) {
    return before !== null && after !== null
      ? this.round(after - before)
      : null;
  }

  private emptyEffectiveness() {
    return {
      available: false,
      before: { main: null, branch: null, gap: null },
      after: { main: null, branch: null, gap: null },
      changeByCampus: { main: null, branch: null, gap: null },
      byCriterion: [],
    };
  }

  private emptyCampusScore(): CampusScore {
    return { main: null, branch: null, gap: null };
  }

  private round(value: number) {
    return Math.round(value * 10) / 10;
  }

  private isNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private unique(values: string[]) {
    return [...new Set(values)];
  }
}
