import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class GuestService {
  constructor(private readonly prisma: PrismaService) {}

  async showcase() {
    const [mainStudents, branchStudents, eventsCount, surveysCount, groups, events, surveys, articles, cycles, mainParticipants, branchParticipants, ratingAnswers] = await Promise.all([
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
        select: { id: true, title: true, category: true, description: true, publishedAt: true },
      }),
      this.prisma.improvementCycle.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, createdAt: true, eventId: true },
      }),
      this.prisma.eventParticipant.count({ where: { status: 'CONFIRMED', student: { campus: 'MAIN' } } }),
      this.prisma.eventParticipant.count({ where: { status: 'CONFIRMED', student: { campus: 'BRANCH' } } }),
      this.prisma.answer.findMany({
        where: { response: { survey: { published: true, type: 'POST_EVENT' } }, question: { type: 'RATING', criterion: { isScored: true } } },
        select: { value: true, responseId: true, response: { select: { student: { select: { campus: true } } } }, question: { select: { criterion: { select: { name: true, order: true } } } } },
      }),
    ]);

    const criterionMap = new Map<string, { order: number; values: Record<'MAIN' | 'BRANCH', number[]>; responses: Record<'MAIN' | 'BRANCH', Set<string>> }>();
    for (const answer of ratingAnswers) {
      const campus = answer.response.student.campus;
      const rating = typeof answer.value === 'number' ? answer.value : null;
      if ((campus !== 'MAIN' && campus !== 'BRANCH') || rating === null || rating < 1 || rating > 5) continue;
      const name = answer.question.criterion.name;
      const row = criterionMap.get(name) ?? { order: answer.question.criterion.order, values: { MAIN: [], BRANCH: [] }, responses: { MAIN: new Set<string>(), BRANCH: new Set<string>() } };
      row.values[campus].push(((rating - 1) / 4) * 100);
      row.responses[campus].add(answer.responseId);
      criterionMap.set(name, row);
    }
    const criterionComparison = [...criterionMap.entries()].sort((a, b) => a[1].order - b[1].order).map(([criterionName, row]) => {
      const mainScore = row.values.MAIN.length ? Math.round(row.values.MAIN.reduce((sum, score) => sum + score, 0) / row.values.MAIN.length * 10) / 10 : null;
      const branchScore = row.values.BRANCH.length ? Math.round(row.values.BRANCH.reduce((sum, score) => sum + score, 0) / row.values.BRANCH.length * 10) / 10 : null;
      return { criterionName, mainScore, branchScore, gap: mainScore === null || branchScore === null ? null : Math.round((mainScore - branchScore) * 10) / 10, responseCount: { MAIN: row.responses.MAIN.size, BRANCH: row.responses.BRANCH.size } };
    });

    // Coarse aggregates only: no student names, usernames, answers, event details,
    // survey questions, participation records, or user-generated post content.
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
      cycles: cycles.map(({ eventId, ...cycle }) => ({ ...cycle, hasEvent: Boolean(eventId) })),
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
        baselineSurvey: { select: { _count: { select: { responses: true } }, aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 1, select: { kind: true, status: true, output: true, createdAt: true } } } },
        event: { select: { id: true, surveys: { where: { type: 'POST_EVENT' }, select: { _count: { select: { responses: true } }, aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 1, select: { kind: true, status: true, output: true, createdAt: true } } } }, aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 1, select: { kind: true, status: true, output: true, createdAt: true } } } },
      },
    });
    if (!cycle) return null;
    const analysis = (row: { kind: string; status: string; output: unknown; createdAt: Date } | undefined) => {
      const output = row?.output && typeof row.output === 'object' && !Array.isArray(row.output) ? row.output as Record<string, unknown> : {};
      return row ? { kind: row.kind, status: row.status, title: typeof output.title === 'string' ? output.title : null, summary: typeof output.summary === 'string' ? output.summary : null, recommendations: Array.isArray(output.recommendations) ? output.recommendations.filter((item): item is string => typeof item === 'string') : [], createdAt: row.createdAt } : null;
    };
    const postSurvey = cycle.event?.surveys[0];
    return {
      id: cycle.id,
      title: cycle.title,
      createdAt: cycle.createdAt,
      stages: [
        { label: 'Khảo sát ban đầu', responseCount: cycle.baselineSurvey._count.responses },
        { label: 'Phân tích AI thực trạng', analysis: analysis(cycle.baselineSurvey.aiAnalyses[0]) },
        { label: 'Hoạt động', available: Boolean(cycle.event) },
        { label: 'Khảo sát sau hoạt động', responseCount: postSurvey?._count.responses ?? 0 },
        { label: 'AI đánh giá hiệu quả', analysis: analysis(postSurvey?.aiAnalyses[0] ?? cycle.event?.aiAnalyses[0]) },
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
