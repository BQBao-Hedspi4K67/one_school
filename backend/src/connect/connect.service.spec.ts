import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Campus, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { ConnectService } from './connect.service';

describe('ConnectService', () => {
  let service: ConnectService;
  const prisma = {
    connectGroup: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    connectMembership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    connectPost: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    connectComment: { create: jest.fn(), deleteMany: jest.fn() },
    connectReaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  const student: AuthenticatedUser = {
    id: 'student-1',
    name: 'Học sinh',
    username: 'student',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    campus: Campus.MAIN,
    avatarUrl: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConnectService(prisma as unknown as PrismaService);
  });

  it('calculates cross-campus participation from comments on approved posts', async () => {
    prisma.connectGroup.findMany.mockResolvedValue([
      {
        id: 'group-1',
        name: 'English Corner',
        description: null,
        memberships: [
          { student: { campus: Campus.MAIN } },
          { student: { campus: Campus.BRANCH } },
        ],
        posts: [
          {
            id: 'cross',
            comments: [
              { author: { campus: Campus.MAIN } },
              { author: { campus: Campus.BRANCH } },
            ],
          },
          { id: 'local', comments: [{ author: { campus: Campus.MAIN } }] },
          { id: 'quiet', comments: [] },
        ],
        _count: { memberships: 2, posts: 4 },
      },
    ]);
    prisma.connectMembership.findMany.mockResolvedValue([]);

    const [group] = await service.listGroups(student);

    expect(group.stats).toMatchObject({
      mainMembers: 1,
      branchMembers: 1,
      approvedPosts: 3,
      comments: 3,
      crossCampusPosts: 1,
      crossCampusPercent: 33,
    });
  });

  it('rejects duplicate group membership', async () => {
    prisma.connectGroup.findUnique.mockResolvedValue({ id: 'group-1' });
    prisma.connectMembership.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.join('group-1', student)).rejects.toThrow(
      ConflictException,
    );
  });

  it('blocks posts from students who have not joined the group', async () => {
    prisma.connectMembership.findUnique.mockResolvedValue(null);

    await expect(
      service.createPost('group-1', { body: 'Xin chào' }, student),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.connectPost.create).not.toHaveBeenCalled();
  });
});
