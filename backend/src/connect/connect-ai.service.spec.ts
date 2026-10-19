import { Campus, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { ConnectAiService } from './connect-ai.service';

describe('ConnectAiService', () => {
  const capturedCreate: { data?: Record<string, unknown> } = {};
  const config = {
    get: jest.fn(
      (key: string) =>
        ({
          AI_API_KEY: 'test-key',
          AI_API_BASE_URL: 'https://ai.example/v1',
          AI_MODEL: 'test-model',
        })[key],
    ),
  };
  const prisma = {
    connectGroup: { findMany: jest.fn() },
    aiAnalysis: {
      create: jest
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) => {
          capturedCreate.data = args.data;
          return Promise.resolve({ id: 'analysis-1' });
        }),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue({
        id: 'analysis-1',
        status: 'COMPLETED',
        output: {
          title: 'Kết nối giữa hai cơ sở',
          summary: 'English Corner có cơ hội tăng tương tác chéo.',
          recommendations: ['Tổ chức thử thách chung.'],
        },
        createdAt: new Date('2026-10-16T00:00:00.000Z'),
        updatedAt: new Date('2026-10-16T00:00:00.000Z'),
        lastError: null,
      }),
    },
  };
  const user: AuthenticatedUser = {
    id: 'teacher-1',
    name: 'Giáo viên',
    username: 'teacher',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    campus: null,
    avatarUrl: null,
  };
  let service: ConnectAiService;
  let previousFetch: typeof fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedCreate.data = undefined;
    previousFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Kết nối giữa hai cơ sở',
                  summary: 'English Corner có cơ hội tăng tương tác chéo.',
                  recommendations: ['Tổ chức thử thách chung.'],
                }),
              },
            },
          ],
        }),
    });
    service = new ConnectAiService(
      prisma as unknown as PrismaService,
      config as never,
    );
  });

  afterEach(() => {
    global.fetch = previousFetch;
  });

  it('sends aggregate activity only and persists a successful insight', async () => {
    prisma.connectGroup.findMany.mockResolvedValue([
      {
        name: 'English Corner',
        memberships: [
          { student: { campus: Campus.MAIN } },
          { student: { campus: Campus.BRANCH } },
        ],
        posts: [
          {
            body: 'PRIVATE POST TEXT',
            author: { campus: Campus.MAIN },
            comments: [
              {
                body: 'PRIVATE COMMENT TEXT',
                author: { campus: Campus.BRANCH },
              },
            ],
            reactions: [{ student: { campus: Campus.BRANCH } }],
          },
        ],
      },
    ]);

    const result = await service.analyze(user);

    const aggregate = capturedCreate.data?.inputAggregate as {
      groups: Array<Record<string, unknown>>;
    };
    expect(aggregate.groups[0]).toMatchObject({
      group: 'English Corner',
      members: { total: 2, main: 1, branch: 1, branchPercent: 50 },
      approvedPosts: 1,
      comments: 1,
      reactions: 1,
      crossCampusInteractions: 2,
      crossCampusPosts: 0,
    });
    expect(JSON.stringify(aggregate)).not.toContain('student@example.com');
    expect(JSON.stringify(aggregate)).not.toContain('body');
    expect(JSON.stringify(aggregate)).not.toContain('PRIVATE');
    expect(prisma.connectGroup.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.aiAnalysis.update).toHaveBeenCalledTimes(1);
    expect(result.summary).toContain('English Corner');
  });

  it('analyzes only the selected group and stores its result separately', async () => {
    prisma.connectGroup.findMany.mockResolvedValue([
      {
        name: 'STEM',
        memberships: [{ student: { campus: Campus.BRANCH } }],
        posts: [],
      },
    ]);

    await service.analyze(user, 'group-stem');

    expect(prisma.connectGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'group-stem' } }),
    );
    expect(capturedCreate.data).toMatchObject({ kind: 'CONNECT_GROUP:group-stem' });
    expect(capturedCreate.data?.inputAggregate).toMatchObject({
      groups: [{ group: 'STEM', members: { main: 0, branch: 1 } }],
    });
  });
});
