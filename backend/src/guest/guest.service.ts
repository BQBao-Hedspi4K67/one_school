import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class GuestService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog() {
    const [mainStudents, branchStudents, eventsCount, surveysCount, groups, events, surveys, articles, mainParticipants, branchParticipants] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT', campus: 'MAIN' } }),
      this.prisma.user.count({ where: { role: 'STUDENT', campus: 'BRANCH' } }),
      this.prisma.event.count({ where: { status: { not: 'DRAFT' } } }),
      this.prisma.survey.count({ where: { published: true } }),
      this.prisma.connectGroup.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, description: true, _count: { select: { memberships: true, posts: { where: { status: 'APPROVED' } } } } } }),
      this.prisma.event.findMany({ where: { status: { not: 'DRAFT' } }, orderBy: { startAt: 'desc' }, select: { id: true, title: true, description: true, coverImageUrl: true, location: true, deliveryMode: true, targetGrades: true, targetCampuses: true, status: true, startAt: true, endAt: true } }),
      this.prisma.survey.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, type: true } }),
      this.prisma.article.findMany({ where: { published: true }, orderBy: { publishedAt: 'desc' }, select: { id: true, title: true, category: true, description: true, coverImageUrl: true, publishedAt: true } }),
      this.prisma.eventParticipant.count({ where: { status: 'CONFIRMED', student: { campus: 'MAIN' } } }),
      this.prisma.eventParticipant.count({ where: { status: 'CONFIRMED', student: { campus: 'BRANCH' } } }),
    ]);
    return {
      aggregates: { mainStudents, branchStudents, publishedEvents: eventsCount, publishedSurveys: surveysCount, communities: groups.length, mainEventParticipations: mainParticipants, branchEventParticipations: branchParticipants },
      groups: groups.map(({ _count, ...group }) => ({ ...group, memberCount: _count.memberships, approvedPostCount: _count.posts })), events, surveys, articles,
    };
  }

  async showcaseAnalytics() {
    const [cycles, criterionAggregates, aiAnalysis] = await Promise.all([
      this.prisma.improvementCycle.findMany({ orderBy: { createdAt: 'desc' }, select: {
        id: true, title: true, createdAt: true,
        baselineSurvey: { select: { published: true, _count: { select: { responses: true } } } },
        event: { select: { id: true, title: true, status: true, startAt: true, endAt: true, coverImageUrl: true, _count: { select: { participants: { where: { status: 'CONFIRMED' } } } } } },
      } }),
      this.prisma.$queryRaw<Array<{ criterionName: string; criterionOrder: number; campus: string; score: number; responseCount: number }>>`
        SELECT c."name" AS "criterionName", MIN(c."order")::int AS "criterionOrder", u."campus"::text AS "campus",
               ROUND(AVG(((a."value" #>> '{}')::numeric - 1) * 25), 1)::float8 AS "score", COUNT(DISTINCT r."id")::int AS "responseCount"
        FROM "Answer" a JOIN "Question" q ON q."id" = a."questionId" JOIN "Criterion" c ON c."id" = q."criterionId"
        JOIN "Response" r ON r."id" = a."responseId" JOIN "Survey" s ON s."id" = r."surveyId" JOIN "User" u ON u."id" = r."studentId"
        WHERE s."published" = true AND s."type"::text = 'POST_EVENT' AND q."type"::text = 'RATING' AND c."isScored" = true
          AND jsonb_typeof(a."value") = 'number' AND (a."value" #>> '{}')::numeric BETWEEN 1 AND 5
        GROUP BY c."name", u."campus" ORDER BY MIN(c."order"), c."name", u."campus"
      `,
      this.prisma.aiAnalysis.findFirst({ where: { kind: 'OVERVIEW', status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, select: { output: true, updatedAt: true } }),
    ]);
    const rows = new Map<string, { order: number; scores: Record<'MAIN' | 'BRANCH', number | null>; responses: Record<'MAIN' | 'BRANCH', number> }>();
    for (const item of criterionAggregates) {
      if (item.campus !== 'MAIN' && item.campus !== 'BRANCH') continue;
      const row = rows.get(item.criterionName) ?? { order: item.criterionOrder, scores: { MAIN: null, BRANCH: null }, responses: { MAIN: 0, BRANCH: 0 } };
      row.scores[item.campus] = Math.round(item.score * 10) / 10;
      row.responses[item.campus] = item.responseCount;
      rows.set(item.criterionName, row);
    }
    const criterionComparison = [...rows.entries()].sort((a, b) => a[1].order - b[1].order).map(([criterionName, row]) => ({ criterionName, mainScore: row.scores.MAIN, branchScore: row.scores.BRANCH, gap: row.scores.MAIN === null || row.scores.BRANCH === null ? null : Math.round((row.scores.MAIN - row.scores.BRANCH) * 10) / 10, responseCount: row.responses }));
    const output = aiAnalysis?.output && typeof aiAnalysis.output === 'object' && !Array.isArray(aiAnalysis.output) ? aiAnalysis.output as Record<string, unknown> : {};
    const publicCycles = cycles.filter((cycle) => cycle.baselineSurvey.published || Boolean(cycle.event && cycle.event.status !== 'DRAFT')).map(({ baselineSurvey, event, ...cycle }) => {
      const publicEvent = event && event.status !== 'DRAFT' ? event : null;
      return { ...cycle, baselineResponseCount: baselineSurvey.published ? baselineSurvey._count.responses : 0, event: publicEvent ? { id: publicEvent.id, title: publicEvent.title, status: publicEvent.status, startAt: publicEvent.startAt, endAt: publicEvent.endAt, coverImageUrl: publicEvent.coverImageUrl, participantsCount: publicEvent._count.participants } : null };
    });
    return { cycles: publicCycles, criterionComparison, aiInsight: aiAnalysis ? { title: typeof output.title === 'string' ? output.title : null, summary: typeof output.summary === 'string' ? output.summary : null, recommendations: Array.isArray(output.recommendations) ? output.recommendations.filter((item): item is string => typeof item === 'string') : [], updatedAt: aiAnalysis.updatedAt } : null };
  }

  async showcase() {
    const [mainStudents, branchStudents, eventsCount, surveysCount, groups, events, surveys, articles, cycles, mainParticipants, branchParticipants, criterionAggregates, aiAnalysis] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT', campus: 'MAIN' } }),
      this.prisma.user.count({ where: { role: 'STUDENT', campus: 'BRANCH' } }),
      this.prisma.event.count({ where: { status: { not: 'DRAFT' } } }),
      this.prisma.survey.count({ where: { published: true } }),
      this.prisma.connectGroup.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          _count: {
            select: {
              memberships: true,
              posts: { where: { status: 'APPROVED' } },
            },
          },
        },
      }),
      this.prisma.event.findMany({
        where: { status: { not: 'DRAFT' } },
        orderBy: { startAt: 'desc' },
        select: { id: true, title: true, status: true, startAt: true, endAt: true },
      }),
      this.prisma.survey.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, type: true },
      }),
      this.prisma.article.findMany({
        where: { published: true },
        orderBy: { publishedAt: 'desc' },
        select: { id: true, title: true, category: true, description: true, coverImageUrl: true, publishedAt: true },
      }),
      this.prisma.improvementCycle.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          createdAt: true,
          baselineSurvey: {
            select: {
              published: true,
              _count: { select: { responses: true } },
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              status: true,
              startAt: true,
              endAt: true,
              coverImageUrl: true,
              _count: { select: { participants: { where: { status: 'CONFIRMED' } } } },
            },
          },
        },
      }),
      this.prisma.eventParticipant.count({ where: { status: 'CONFIRMED', student: { campus: 'MAIN' } } }),
      this.prisma.eventParticipant.count({ where: { status: 'CONFIRMED', student: { campus: 'BRANCH' } } }),
      this.prisma.$queryRaw<Array<{ criterionName: string; criterionOrder: number; campus: string; score: number; responseCount: number }>>`
        SELECT c."name" AS "criterionName",
               MIN(c."order")::int AS "criterionOrder",
               u."campus"::text AS "campus",
               ROUND(AVG(((a."value" #>> '{}')::numeric - 1) * 25), 1)::float8 AS "score",
               COUNT(DISTINCT r."id")::int AS "responseCount"
        FROM "Answer" a
        JOIN "Question" q ON q."id" = a."questionId"
        JOIN "Criterion" c ON c."id" = q."criterionId"
        JOIN "Response" r ON r."id" = a."responseId"
        JOIN "Survey" s ON s."id" = r."surveyId"
        JOIN "User" u ON u."id" = r."studentId"
        WHERE s."published" = true
          AND s."type"::text = 'POST_EVENT'
          AND q."type"::text = 'RATING'
          AND c."isScored" = true
          AND jsonb_typeof(a."value") = 'number'
          AND (a."value" #>> '{}')::numeric BETWEEN 1 AND 5
        GROUP BY c."name", u."campus"
        ORDER BY MIN(c."order"), c."name", u."campus"
      `,
      this.prisma.aiAnalysis.findFirst({
        where: { kind: 'OVERVIEW', status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: { output: true, updatedAt: true },
      }),
    ]);

    const criterionMap = new Map<string, { order: number; scores: Record<'MAIN' | 'BRANCH', number | null>; responses: Record<'MAIN' | 'BRANCH', number> }>();
    for (const aggregate of criterionAggregates) {
      if (aggregate.campus !== 'MAIN' && aggregate.campus !== 'BRANCH') continue;
      const row = criterionMap.get(aggregate.criterionName) ?? { order: aggregate.criterionOrder, scores: { MAIN: null, BRANCH: null }, responses: { MAIN: 0, BRANCH: 0 } };
      row.scores[aggregate.campus] = Math.round(aggregate.score * 10) / 10;
      row.responses[aggregate.campus] = aggregate.responseCount;
      criterionMap.set(aggregate.criterionName, row);
    }
    const criterionComparison = [...criterionMap.entries()].sort((a, b) => a[1].order - b[1].order).map(([criterionName, row]) => ({
      criterionName,
      mainScore: row.scores.MAIN,
      branchScore: row.scores.BRANCH,
      gap: row.scores.MAIN === null || row.scores.BRANCH === null ? null : Math.round((row.scores.MAIN - row.scores.BRANCH) * 10) / 10,
      responseCount: row.responses,
    }));
    const aiOutput = aiAnalysis?.output && typeof aiAnalysis.output === 'object' && !Array.isArray(aiAnalysis.output)
      ? aiAnalysis.output as Record<string, unknown>
      : {};

    // Public catalogs and aggregate counts only; no identities, answers, or participation records.
    return {
      aggregates: {
        mainStudents,
        branchStudents,
        publishedEvents: eventsCount,
        publishedSurveys: surveysCount,
        communities: groups.length,
        mainEventParticipations: mainParticipants,
        branchEventParticipations: branchParticipants,
      },
      groups: groups.map(({ _count, ...group }) => ({
        ...group,
        memberCount: _count.memberships,
        approvedPostCount: _count.posts,
      })),
      events,
      surveys,
      articles,
      cycles: cycles
        .filter((cycle) => cycle.baselineSurvey.published || Boolean(cycle.event && cycle.event.status !== 'DRAFT'))
        .map(({ baselineSurvey, event, ...cycle }) => {
          const publicEvent = event && event.status !== 'DRAFT' ? event : null;
          return {
            ...cycle,
            baselineResponseCount: baselineSurvey.published ? baselineSurvey._count.responses : 0,
            event: publicEvent ? {
              id: publicEvent.id,
              title: publicEvent.title,
              status: publicEvent.status,
              startAt: publicEvent.startAt,
              endAt: publicEvent.endAt,
              coverImageUrl: publicEvent.coverImageUrl,
              participantsCount: publicEvent._count.participants,
            } : null,
          };
        }),
      aiInsight: aiAnalysis ? {
        title: typeof aiOutput.title === 'string' ? aiOutput.title : null,
        summary: typeof aiOutput.summary === 'string' ? aiOutput.summary : null,
        recommendations: Array.isArray(aiOutput.recommendations)
          ? aiOutput.recommendations.filter((item): item is string => typeof item === 'string')
          : [],
        updatedAt: aiAnalysis.updatedAt,
      } : null,
      criterionComparison,
    };
  }

  studentEvent(id: string) {
    return this.prisma.event.findFirst({
      where: { id, status: { not: 'DRAFT' } },
      select: { id: true, title: true, description: true, objective: true, coverImageUrl: true, startAt: true, endAt: true, location: true, deliveryMode: true, targetGrades: true, targetCampuses: true, status: true },
    });
  }

  studentSurvey(id: string) {
    return this.prisma.survey.findFirst({
      where: { id, published: true },
      select: { id: true, title: true, description: true, type: true, questions: { orderBy: { order: 'asc' }, select: { id: true, prompt: true, type: true, options: true, order: true } } },
    });
  }

  article(id: string) {
    return this.prisma.article.findFirst({
      where: { id, published: true },
      select: { id: true, title: true, category: true, description: true, content: true, coverImageUrl: true, imageUrls: true, publishedAt: true },
    });
  }

  async cycle(id: string) {
    const cycle = await this.prisma.improvementCycle.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        createdAt: true,
        baselineSurvey: {
          select: {
            id: true,
            title: true,
            published: true,
            _count: { select: { responses: true } },
            aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 1, select: { kind: true, status: true, output: true, createdAt: true } },
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            startAt: true,
            endAt: true,
            coverImageUrl: true,
            _count: { select: { participants: { where: { status: 'CONFIRMED' } } } },
            surveys: {
              where: { type: 'POST_EVENT', published: true },
              select: {
                id: true,
                title: true,
                _count: { select: { responses: true } },
                responses: {
                  select: {
                    id: true,
                    student: { select: { campus: true } },
                    answers: {
                      where: { question: { type: 'RATING', criterion: { isScored: true } } },
                      select: {
                        value: true,
                        question: { select: { criterion: { select: { id: true, name: true, order: true } } } },
                      },
                    },
                  },
                },
                aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 1, select: { kind: true, status: true, output: true, createdAt: true } },
              },
            },
            aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 1, select: { kind: true, status: true, output: true, createdAt: true } },
          },
        },
      },
    });
    if (!cycle) return null;
    const publicBaselineSurvey = cycle.baselineSurvey.published ? cycle.baselineSurvey : null;
    const publicEvent = cycle.event && cycle.event.status !== 'DRAFT' ? cycle.event : null;
    if (!publicBaselineSurvey && !publicEvent) return null;
    const analysis = (row: { kind: string; status: string; output: unknown; createdAt: Date } | undefined) => {
      const output = row?.output && typeof row.output === 'object' && !Array.isArray(row.output) ? row.output as Record<string, unknown> : {};
      return row?.status === 'COMPLETED' ? { kind: row.kind, status: row.status, title: typeof output.title === 'string' ? output.title : null, summary: typeof output.summary === 'string' ? output.summary : null, recommendations: Array.isArray(output.recommendations) ? output.recommendations.filter((item): item is string => typeof item === 'string') : [], createdAt: row.createdAt } : null;
    };
    const postSurvey = publicEvent?.surveys[0];
    const afterCriteria = new Map<string, {
      name: string;
      order: number;
      values: Record<'MAIN' | 'BRANCH', number[]>;
      responses: Record<'MAIN' | 'BRANCH', Set<string>>;
    }>();
    for (const response of postSurvey?.responses ?? []) {
      const campus = response.student.campus;
      if (campus !== 'MAIN' && campus !== 'BRANCH') continue;
      for (const answer of response.answers) {
        const value = answer.value;
        if (typeof value !== 'number' || value < 1 || value > 5) continue;
        const criterion = answer.question.criterion;
        const row = afterCriteria.get(criterion.id) ?? {
          name: criterion.name,
          order: criterion.order,
          values: { MAIN: [], BRANCH: [] },
          responses: { MAIN: new Set<string>(), BRANCH: new Set<string>() },
        };
        row.values[campus].push(((value - 1) / 4) * 100);
        row.responses[campus].add(response.id);
        afterCriteria.set(criterion.id, row);
      }
    }
    const afterByCriterion = [...afterCriteria.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([criterionId, row]) => {
        const mainScore = row.values.MAIN.length
          ? Math.round(row.values.MAIN.reduce((sum, value) => sum + value, 0) / row.values.MAIN.length * 10) / 10
          : null;
        const branchScore = row.values.BRANCH.length
          ? Math.round(row.values.BRANCH.reduce((sum, value) => sum + value, 0) / row.values.BRANCH.length * 10) / 10
          : null;
        return {
          criterionId,
          criterionName: row.name,
          mainScore,
          branchScore,
          gap: mainScore === null || branchScore === null ? null : Math.round((mainScore - branchScore) * 10) / 10,
          responseCount: { MAIN: row.responses.MAIN.size, BRANCH: row.responses.BRANCH.size },
        };
      });
    return {
      id: cycle.id,
      title: cycle.title,
      createdAt: cycle.createdAt,
      baselineSurvey: publicBaselineSurvey ? { id: publicBaselineSurvey.id, title: publicBaselineSurvey.title } : null,
      event: publicEvent ? {
        id: publicEvent.id,
        title: publicEvent.title,
        startAt: publicEvent.startAt,
        endAt: publicEvent.endAt,
        coverImageUrl: publicEvent.coverImageUrl,
        participantsCount: publicEvent._count.participants,
      } : null,
      afterByCriterion,
      stages: [
        { label: 'Khảo sát ban đầu', surveyId: publicBaselineSurvey?.id ?? null, surveyTitle: publicBaselineSurvey?.title ?? null, responseCount: publicBaselineSurvey?._count.responses ?? 0 },
        { label: 'Phân tích AI thực trạng', analysis: analysis(publicBaselineSurvey?.aiAnalyses[0]) },
        { label: 'Hoạt động', available: Boolean(publicEvent), eventId: publicEvent?.id ?? null, eventTitle: publicEvent?.title ?? null, participantsCount: publicEvent?._count.participants ?? 0 },
        { label: 'Khảo sát sau hoạt động', surveyId: postSurvey?.id ?? null, surveyTitle: postSurvey?.title ?? null, responseCount: postSurvey?._count.responses ?? 0 },
        { label: 'AI đánh giá hiệu quả', analysis: analysis(postSurvey?.aiAnalyses[0] ?? publicEvent?.aiAnalyses[0]) },
      ],
    };
  }

  async group(id: string) {
    const [group, studentIdentities] = await Promise.all([
      this.prisma.connectGroup.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          posts: {
            where: { status: 'APPROVED' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              body: true,
              imageUrl: true,
              imageUrls: true,
              createdAt: true,
              _count: { select: { reactions: true } },
              comments: {
                where: { parentId: null },
                orderBy: { createdAt: 'asc' },
                take: 6,
                select: {
                  body: true,
                  createdAt: true,
                  replies: { orderBy: { createdAt: 'asc' }, take: 2, select: { body: true, createdAt: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.user.findMany({ where: { role: 'STUDENT' }, select: { name: true, username: true } }),
    ]);
    if (!group) return null;
    const identities = studentIdentities.flatMap(({ name, username }) => [name, username]).filter((value) => value.trim().length >= 4).sort((a, b) => b.length - a.length);
    const identityPattern = identities.length
      ? new RegExp(`(^|[^\\p{L}\\p{N}])(?:${identities.map((identity) => identity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu')
      : null;
    const redact = (value: string) => {
      let text = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[đã ẩn thông tin]')
        .replace(/\b0\d{9,10}\b/g, '[đã ẩn thông tin]');
      if (identityPattern) text = text.replace(identityPattern, '$1một bạn');
      return text;
    };
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      posts: group.posts.map((post) => ({
        body: redact(post.body),
        hasImage: Boolean(post.imageUrl || post.imageUrls.length),
        createdAt: post.createdAt,
        reactionCount: post._count.reactions,
        authorLabel: 'Học sinh',
        comments: post.comments.flatMap((comment) => [
          { body: redact(comment.body), createdAt: comment.createdAt, authorLabel: 'Bạn học' },
          ...comment.replies.map((reply) => ({ body: redact(reply.body), createdAt: reply.createdAt, authorLabel: 'Bạn học' })),
        ]),
      })),
    };
  }
}
