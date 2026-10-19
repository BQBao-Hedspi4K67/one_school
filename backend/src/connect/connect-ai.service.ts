import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Campus, ConnectPostStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

const CONNECT_PROMPT_VERSION = 'connect-behavior-v1';
type ConnectAiConfig = { get<T = string>(key: string): T | undefined };

@Injectable()
export class ConnectAiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('CONNECT_AI_CONFIG') private readonly config: ConnectAiConfig,
  ) {}

  async latest(groupId?: string) {
    const analysis = await this.prisma.aiAnalysis.findFirst({
      where: {
        kind: groupId ? `CONNECT_GROUP:${groupId}` : 'CONNECT',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        output: true,
        createdAt: true,
        updatedAt: true,
        lastError: true,
      },
    });
    const output = this.asRecord(analysis?.output);
    return {
      analysisId: analysis?.id ?? null,
      status: analysis?.status ?? null,
      title: typeof output.title === 'string' ? output.title : null,
      summary: typeof output.summary === 'string' ? output.summary : null,
      recommendations: Array.isArray(output.recommendations)
        ? output.recommendations.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
      createdAt: analysis?.createdAt.toISOString() ?? null,
      updatedAt: analysis?.updatedAt.toISOString() ?? null,
      canRetry: analysis?.status === 'FAILED',
      error: analysis?.status === 'FAILED' ? analysis.lastError : null,
    };
  }

  async analyze(user: AuthenticatedUser, groupId?: string) {
    const aggregate = await this.buildAggregate(groupId);
    if (!aggregate.groups.length) {
      throw new BadRequestException(
        groupId
          ? 'Chưa có dữ liệu nhóm CONNECT để phân tích'
          : 'Chưa có nhóm CONNECT để phân tích',
      );
    }
    const analysis = await this.prisma.aiAnalysis.create({
      data: {
        authorId: user.id,
        kind: groupId ? `CONNECT_GROUP:${groupId}` : 'CONNECT',
        status: 'PENDING',
        inputAggregate: aggregate,
        attemptCount: 1,
        promptVersion: CONNECT_PROMPT_VERSION,
      },
    });

    try {
      const output = await this.callAi(aggregate);
      await this.prisma.aiAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: 'COMPLETED',
          output,
          model: this.config.get<string>('AI_MODEL'),
          completedAt: new Date(),
          lastError: null,
        },
      });
      return this.latest(groupId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI provider error';
      await this.prisma.aiAnalysis.update({
        where: { id: analysis.id },
        data: { status: 'FAILED', lastError: message },
      });
      throw new BadGatewayException(
        'Phân tích hoạt động CONNECT chưa hoàn tất. Em thử lại sau nhé.',
      );
    }
  }

  private async buildAggregate(groupId?: string) {
    const groups = await this.prisma.connectGroup.findMany({
      ...(groupId ? { where: { id: groupId } } : {}),
      orderBy: { name: 'asc' },
      select: {
        name: true,
        memberships: { select: { student: { select: { campus: true } } } },
        posts: {
          where: { status: ConnectPostStatus.APPROVED },
          select: {
            author: { select: { campus: true } },
            comments: { select: { author: { select: { campus: true } } } },
            reactions: { select: { student: { select: { campus: true } } } },
          },
        },
      },
    });

    const groupAggregates = groups.map((group) => {
      const mainMembers = group.memberships.filter(
        (membership) => membership.student.campus === Campus.MAIN,
      ).length;
      const branchMembers = group.memberships.filter(
        (membership) => membership.student.campus === Campus.BRANCH,
      ).length;
      const approvedPosts = group.posts.length;
      let comments = 0;
      let reactions = 0;
      let crossCampusPosts = 0;
      let crossCampusInteractions = 0;

      for (const post of group.posts) {
        comments += post.comments.length;
        reactions += post.reactions.length;
        const commentingCampuses = new Set(
          post.comments.map((comment) => comment.author.campus),
        );
        if (
          commentingCampuses.has(Campus.MAIN) &&
          commentingCampuses.has(Campus.BRANCH)
        ) {
          crossCampusPosts += 1;
        }
        if (post.author.campus) {
          crossCampusInteractions += post.comments.filter(
            (comment) =>
              comment.author.campus &&
              comment.author.campus !== post.author.campus,
          ).length;
          crossCampusInteractions += post.reactions.filter(
            (reaction) =>
              reaction.student.campus &&
              reaction.student.campus !== post.author.campus,
          ).length;
        }
      }

      const memberCount = mainMembers + branchMembers;
      return {
        group: group.name,
        members: {
          total: memberCount,
          main: mainMembers,
          branch: branchMembers,
          branchPercent: memberCount
            ? Math.round((branchMembers / memberCount) * 100)
            : 0,
        },
        approvedPosts,
        comments,
        reactions,
        crossCampusInteractions,
        crossCampusPosts,
        crossCampusPostPercent: approvedPosts
          ? Math.round((crossCampusPosts / approvedPosts) * 100)
          : 0,
      };
    });

    return {
      source: 'CONNECT_GROUP_ACTIVITY_AGGREGATES',
      groups: groupAggregates,
      totals: {
        groups: groupAggregates.length,
        mainMembers: groupAggregates.reduce(
          (sum, group) => sum + group.members.main,
          0,
        ),
        branchMembers: groupAggregates.reduce(
          (sum, group) => sum + group.members.branch,
          0,
        ),
        approvedPosts: groupAggregates.reduce(
          (sum, group) => sum + group.approvedPosts,
          0,
        ),
        comments: groupAggregates.reduce(
          (sum, group) => sum + group.comments,
          0,
        ),
        reactions: groupAggregates.reduce(
          (sum, group) => sum + group.reactions,
          0,
        ),
        crossCampusInteractions: groupAggregates.reduce(
          (sum, group) => sum + group.crossCampusInteractions,
          0,
        ),
      },
    };
  }

  private async callAi(inputAggregate: Prisma.InputJsonObject) {
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
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Bạn là trợ lý phân tích hoạt động cộng đồng học sinh của trường THCS có Điểm chính và Phân hiệu. Chỉ phân tích số liệu tổng hợp được cung cấp. Dữ liệu không có danh tính học sinh, tên tài khoản, nội dung bài đăng hoặc nội dung bình luận; không yêu cầu, suy đoán hay tạo ra các thông tin đó. Đánh giá mức tham gia theo cơ sở, số bài/bình luận/cảm xúc, mức tương tác chéo và nhóm hoạt động mạnh/yếu. Khi số lượng nhỏ, nêu rõ đây là tín hiệu ban đầu, không kết luận chắc chắn. Đề xuất hoạt động liên điểm trường cụ thể, phù hợp lứa tuổi, ví dụ thử thách học tập hoặc chủ đề chia sẻ chung. Không gắn nhãn tiêu cực cho học sinh hay cơ sở. Trả về duy nhất JSON có title (chuỗi), summary (chuỗi ngắn) và recommendations (mảng 3 đến 5 chuỗi hành động cụ thể). Nêu tên nhóm đúng như dữ liệu khi nhận xét.',
            },
            {
              role: 'user',
              content: JSON.stringify(inputAggregate),
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

  private asRecord(value: Prisma.JsonValue | null | undefined) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
