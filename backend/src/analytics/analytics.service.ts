import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Campus,
  Prisma,
  QuestionType,
  RegistrationStatus,
  SurveyType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CampusScore,
  DashboardFilters,
  DashboardResponse,
} from './analytics.types';
import { CALCULATION_VERSION, calculateCampusScores } from './scoring';

type ResponseWithAnswers = Prisma.ResponseGetPayload<{
  include: {
    student: { select: { campus: true } };
    answers: { include: { question: { include: { criterion: true } } } };
  };
}>;

type ScoreMap = Map<string, Map<Campus, number>>;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getDashboard(
    filters: DashboardFilters = {},
    user?: AuthenticatedUser,
  ): Promise<DashboardResponse> {
    const defaultToBaseline =
      !filters.surveyId && !filters.eventId && !filters.surveyType;
    const surveys = await this.prisma.survey.findMany({
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
    });

    if (filters.surveyId && surveys.length === 0) {
      throw new NotFoundException('Không tìm thấy khảo sát được chọn');
    }
    if (filters.eventId && surveys.length === 0) {
      throw new NotFoundException(
        'Không tìm thấy dữ liệu khảo sát của sự kiện',
      );
    }

    const availableSurveys = await this.prisma.survey.findMany({
      where: {
        published: true,
        ...(user?.role === UserRole.TEACHER ? { teacherId: user.id } : {}),
      },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const events = await this.prisma.event.findMany({
      where: {
        status: { not: 'DRAFT' },
        ...(user?.role === UserRole.TEACHER ? { teacherId: user.id } : {}),
      },
      select: { id: true, title: true },
      orderBy: { startAt: 'desc' },
    });

    const selectedSurveyIds = surveys.map((survey) => survey.id);
    const responses = await this.getResponses(selectedSurveyIds);
    const scores = this.buildScores(responses);
    const overall = this.averageScores(scores);
    const studentsByCampus = await this.countStudentsByCampus();
    const completedByCampus = this.countDistinctRespondents(responses);
    const completion = {
      main: this.rate(
        completedByCampus.get(Campus.MAIN) ?? 0,
        studentsByCampus.main,
      ),
      branch: this.rate(
        completedByCampus.get(Campus.BRANCH) ?? 0,
        studentsByCampus.branch,
      ),
    };

    const selectedEventIds = this.unique(
      surveys
        .map((survey) => survey.eventId)
        .filter((id): id is string => Boolean(id)),
    );
    const eventIds = filters.eventId ? [filters.eventId] : selectedEventIds;
    const participants = await this.countParticipants(eventIds);
    const criterionComparison = this.buildCriterionComparison(
      responses,
      scores,
    );
    const questionBreakdown = this.buildQuestionBreakdown(responses);
    const aiInsight = await this.getAiInsight(selectedSurveyIds, eventIds);
    const effectiveness = await this.getEffectiveness(filters.eventId);

    // Khu vực 2: 4 KPI stats thực tế từ DB
    const kpiStats = await this.buildKpiStats(user);

    // Khu vực 3: So sánh theo tiêu chí trung bình cộng toàn bộ khảo sát (MAIN vs BRANCH)
    const allSurveysCriterionComparison = await this.buildAllSurveysCriterionComparison();

    // Khu vực 4: Các chu kỳ cải thiện 4 bước (CycleProgressStepper)
    const cycles = await this.buildImprovementCycles(user);

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
        eventCount: await this.countEvents(eventIds),
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
    const teacherFilter = user?.role === UserRole.TEACHER ? { teacherId: user.id } : {};
    
    // 1. Số khảo sát đang mở (published: true)
    const openSurveysCount = await this.prisma.survey.count({
      where: { published: true, ...teacherFilter },
    });

    const totalPublishedSurveysCount = openSurveysCount;

    // 2. Học sinh đã tham gia khảo sát (distinct học sinh đã trả lời ít nhất 1 khảo sát) vs Tổng học sinh
    const totalStudentsCount = await this.prisma.user.count({
      where: { role: UserRole.STUDENT },
    });

    const distinctRespondents = await this.prisma.response.groupBy({
      by: ['studentId'],
      ...(user?.role === UserRole.TEACHER
        ? { where: { survey: { teacherId: user.id } } }
        : {}),
    });
    const respondedStudentsCount = distinctRespondents.length;
    const responseRate = totalStudentsCount > 0
      ? this.round((respondedStudentsCount / totalStudentsCount) * 100)
      : 0;

    // 3. Số khuyến nghị AI đang có / chờ thực hiện
    const analyses = await this.prisma.aiAnalysis.findMany({
      where: {
        status: 'SUCCESS',
        ...(user?.role === UserRole.TEACHER ? { authorId: user.id } : {}),
      },
      select: { output: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    let pendingAiCount = 0;
    for (const a of analyses) {
      const out = this.asRecord(a.output);
      if (Array.isArray(out.recommendations)) {
        pendingAiCount += out.recommendations.length;
      }
    }
    // Nếu chưa có phân tích nào, đếm các phân tích đang PENDING
    if (pendingAiCount === 0) {
      pendingAiCount = await this.prisma.aiAnalysis.count({
        where: {
          status: 'PENDING',
          ...(user?.role === UserRole.TEACHER ? { authorId: user.id } : {}),
        },
      });
    }

    // 4. Sự kiện sắp diễn ra hoặc đang diễn ra
    const upcomingEventsCount = await this.prisma.event.count({
      where: {
        status: { in: ['UPCOMING', 'LIVE'] },
        ...teacherFilter,
      },
    });

    return {
      openSurveysCount,
      totalPublishedSurveysCount,
      totalStudentsCount,
      respondedStudentsCount,
      responseRate,
      pendingAiCount,
      upcomingEventsCount,
    };
  }

  private async buildAllSurveysCriterionComparison() {
    // Lấy toàn bộ phản hồi từ các khảo sát đã published
    const publishedSurveys = await this.prisma.survey.findMany({
      where: { published: true },
      select: { id: true },
    });
    const surveyIds = publishedSurveys.map((s) => s.id);
    if (!surveyIds.length) return [];

    const responses = await this.getResponses(surveyIds);
    if (!responses.length) return [];

    // Nhóm điểm số theo Criterion Name (do các khảo sát có thể có criterion trùng tên hoặc chuẩn 4 tiêu chí)
    const valuesByName = new Map<string, Map<Campus, number[]>>();
    const responseCounts = new Map<string, Map<Campus, Set<string>>>();

    for (const response of responses) {
      const campus = response.student.campus;
      if (!campus) continue;

      for (const answer of response.answers) {
        const score = this.toScore(answer.value, answer.question.type);
        if (score === null) continue;

        const name = `Tiêu chí ${answer.question.criterion.order}`;
        const campusMap = valuesByName.get(name) ?? new Map<Campus, number[]>();
        const list = campusMap.get(campus) ?? [];
        list.push(score);
        campusMap.set(campus, list);
        valuesByName.set(name, campusMap);

        const countMap = responseCounts.get(name) ?? new Map<Campus, Set<string>>();
        const studentSet = countMap.get(campus) ?? new Set<string>();
        studentSet.add(response.studentId);
        countMap.set(campus, studentSet);
        responseCounts.set(name, countMap);
      }
    }

    return [...valuesByName.entries()].map(([criterionName, campusMap]) => {
      const mainScores = campusMap.get(Campus.MAIN) ?? [];
      const branchScores = campusMap.get(Campus.BRANCH) ?? [];
      const mainScore = mainScores.length ? this.round(this.average(mainScores)) : null;
      const branchScore = branchScores.length ? this.round(this.average(branchScores)) : null;
      return {
        criterionName,
        mainScore,
        branchScore,
        gap: this.gap(mainScore, branchScore),
        responseCount: {
          MAIN: responseCounts.get(criterionName)?.get(Campus.MAIN)?.size ?? 0,
          BRANCH: responseCounts.get(criterionName)?.get(Campus.BRANCH)?.size ?? 0,
        },
      };
    });
  }

  private async buildImprovementCycles(user?: AuthenticatedUser): Promise<DashboardResponse['cycles']> {
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
          },
        },
        aiAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        participants: {
          where: { status: RegistrationStatus.CONFIRMED },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const cycles: DashboardResponse['cycles'] = [];

    for (const evt of events) {
      const baselineSurvey = evt.baselineSurvey;
      const postSurvey = evt.surveys[0] ?? null;
      const aiAnalysis = evt.aiAnalyses[0] ?? null;
      const aiOutput = this.asRecord(aiAnalysis?.output);

      const baselineResponsesCount = baselineSurvey?._count.responses ?? 0;
      const postResponsesCount = postSurvey?._count.responses ?? 0;
      const participantsCount = evt.participants.length;

      // Xác định trạng thái của từng bước trong 4 bước
      // Bước 1: Khảo sát ban đầu
      const step1Status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' =
        baselineResponsesCount > 0 ? 'COMPLETED' : baselineSurvey?.published ? 'IN_PROGRESS' : 'WAITING';

      // Bước 2: Phân tích AI
      const step2Status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' =
        aiAnalysis?.status === 'SUCCESS' ? 'COMPLETED' : aiAnalysis?.status === 'PENDING' ? 'IN_PROGRESS' : 'WAITING';

      // Bước 3: Tổ chức sự kiện
      const step3Status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' =
        evt.status === 'COMPLETED' ? 'COMPLETED' : evt.status === 'LIVE' ? 'IN_PROGRESS' : 'WAITING';

      // Bước 4: Đánh giá sau sự kiện
      const step4Status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' =
        postResponsesCount > 0 ? 'COMPLETED' : postSurvey?.published ? 'IN_PROGRESS' : 'WAITING';

      // Xác định currentStep (1..4)
      let currentStep = 1;
      if (step1Status === 'COMPLETED') currentStep = 2;
      if (step2Status === 'COMPLETED') currentStep = 3;
      if (step3Status === 'COMPLETED') currentStep = 4;
      if (step4Status === 'COMPLETED') currentStep = 4;

      // Tính điểm trước & sau
      let beforeScore: CampusScore = { main: null, branch: null, gap: null };
      if (baselineSurvey) {
        beforeScore = await this.averageForSurvey(baselineSurvey.id);
      }

      let afterScore: CampusScore = { main: null, branch: null, gap: null };
      if (postSurvey) {
        afterScore = await this.averageForSurvey(postSurvey.id);
      }

      const gapBefore = beforeScore.gap;
      const gapAfter = afterScore.gap;
      const gapChange = gapBefore !== null && gapAfter !== null ? this.round(gapAfter - gapBefore) : null;

      const recommendations = Array.isArray(aiOutput.recommendations)
        ? aiOutput.recommendations.filter((r): r is string => typeof r === 'string')
        : [];

      cycles.push({
        id: evt.id,
        title: evt.title,
        status: evt.status as 'DRAFT' | 'UPCOMING' | 'LIVE' | 'COMPLETED',
        startAt: evt.startAt.toISOString(),
        endAt: evt.endAt.toISOString(),
        currentStep,
        steps: {
          step1: {
            name: '01. Khảo sát ban đầu',
            status: step1Status,
            surveyId: baselineSurvey?.id ?? '',
            surveyTitle: baselineSurvey?.title ?? 'Chưa gắn khảo sát',
            responsesCount: baselineResponsesCount,
          },
          step2: {
            name: '02. Phân tích AI',
            status: step2Status,
            analysisId: aiAnalysis?.id ?? null,
            summary: typeof aiOutput.summary === 'string' ? aiOutput.summary : null,
            recommendationsCount: recommendations.length,
          },
          step3: {
            name: '03. Tổ chức sự kiện',
            status: step3Status,
            eventId: evt.id,
            eventTitle: evt.title,
            participantsCount,
          },
          step4: {
            name: '04. Đánh giá sau sự kiện',
            status: step4Status,
            surveyId: postSurvey?.id ?? null,
            surveyTitle: postSurvey?.title ?? null,
            responsesCount: postResponsesCount,
          },
        },
        metrics: {
          beforeScore,
          afterScore,
          gapChange,
          aiEvaluation: {
            summary: typeof aiOutput.summary === 'string' ? aiOutput.summary : null,
            recommendations,
          },
        },
      });
    }

    return cycles;
  }


  private async getResponses(
    surveyIds: string[],
  ): Promise<ResponseWithAnswers[]> {
    if (surveyIds.length === 0) return [];
    return this.prisma.response.findMany({
      where: { surveyId: { in: surveyIds } },
      include: {
        student: { select: { campus: true } },
        answers: {
          include: { question: { include: { criterion: true } } },
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
    const surveyIds = await this.getAnalysisSurveyIds(filters, user.id);
    if (!surveyIds.length) {
      throw new BadRequestException('Chưa có khảo sát phù hợp để phân tích');
    }
    return this.runAnalysis(surveyIds, filters.eventId, user.id);
  }

  async retryAnalysis(id: string, user: AuthenticatedUser) {
    const analysis = await this.prisma.aiAnalysis.findFirst({
      where: { id, authorId: user.id, status: 'FAILED' },
    });
    if (!analysis) {
      throw new NotFoundException('Không tìm thấy phân tích AI cần chạy lại');
    }
    const surveyIds = analysis.surveyId ? [analysis.surveyId] : [];
    return this.runAnalysis(
      surveyIds,
      analysis.eventId ?? undefined,
      user.id,
      id,
    );
  }

  private async getAnalysisSurveyIds(
    filters: DashboardFilters,
    teacherId: string,
  ) {
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
      return [
        event.baselineSurveyId,
        ...event.surveys.map((survey) => survey.id),
      ];
    }
    const surveys = await this.prisma.survey.findMany({
      where: {
        teacherId,
        ...(filters.surveyId ? { id: filters.surveyId } : {}),
        ...(filters.surveyType ? { type: filters.surveyType } : {}),
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
  ) {
    const responses = await this.getResponses(surveyIds);
    const inputAggregate = this.buildAiAggregate(responses);
    const analysis = existingId
      ? await this.prisma.aiAnalysis.update({
          where: { id: existingId },
          data: {
            status: 'PENDING',
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
            kind: eventId ? 'EFFECTIVENESS' : 'BASELINE',
            status: 'PENDING',
            inputAggregate,
            attemptCount: 1,
            promptVersion: 'one-school-analysis-v1',
          },
        });

    try {
      const output = await this.callAi(inputAggregate);
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
    const criteria = [...scores.criteria.entries()].map(
      ([criterionId, campuses]) => ({
        criterionId,
        main: campuses.get(Campus.MAIN)?.score ?? null,
        branch: campuses.get(Campus.BRANCH)?.score ?? null,
        mainResponseCount: campuses.get(Campus.MAIN)?.responseCount ?? 0,
        branchResponseCount: campuses.get(Campus.BRANCH)?.responseCount ?? 0,
      }),
    );
    const text = responses
      .flatMap((response) =>
        response.answers
          .filter((answer) => answer.question.type === 'OPEN_TEXT')
          .map((answer) => this.sanitizeText(answer.value)),
      )
      .filter((value): value is string => Boolean(value));
    return {
      calculationVersion: CALCULATION_VERSION,
      responseCount: responses.length,
      scores: {
        MAIN: scores.overall.get(Campus.MAIN) ?? null,
        BRANCH: scores.overall.get(Campus.BRANCH) ?? null,
      },
      criteria,
      openText: text.slice(0, 100),
    };
  }

  private sanitizeText(value: Prisma.JsonValue) {
    if (typeof value !== 'string') return null;
    const sanitized = value
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[url]')
      .replace(/\b(?:0|\+84)[\d .-]{8,}\b/g, '[phone]')
      .trim()
      .slice(0, 500);
    return sanitized || null;
  }

  private async callAi(inputAggregate: Prisma.InputJsonValue) {
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
              content:
                'Bạn là trợ lý phân tích khảo sát giáo dục. Chỉ dùng dữ liệu aggregate. Trả JSON gồm title, summary và recommendations là mảng chuỗi. Không suy đoán danh tính.',
            },
            { role: 'user', content: JSON.stringify(inputAggregate) },
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
        criteria.set(criterion.id, `Tiêu chí ${criterion.order}`);
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
          criterionName: `Tiêu chí ${answer.question.criterion.order}`,
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
    surveyIds: string[],
    eventIds: string[],
  ): Promise<DashboardResponse['aiInsight']> {
    const analysis = await this.prisma.aiAnalysis.findFirst({
      where: {
        OR: [
          ...(surveyIds.length ? [{ surveyId: { in: surveyIds } }] : []),
          ...(eventIds.length ? [{ eventId: { in: eventIds } }] : []),
        ],
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
        const criterionName = `Tiêu chí ${answer.question.criterion.order}`;
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
