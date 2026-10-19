import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Campus, ConnectPostStatus, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type {
  ConnectCommentDto,
  ConnectPostDto,
  SaveConnectGroupDto,
} from './dto/connect.dto';

const userCard = {
  id: true,
  name: true,
  campus: true,
  avatarUrl: true,
} as const;

@Injectable()
export class ConnectService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups(user: AuthenticatedUser) {
    const groups = await this.prisma.connectGroup.findMany({
      orderBy: { name: 'asc' },
      include: {
        memberships: { select: { student: { select: { campus: true } } } },
        posts: {
          where: { status: ConnectPostStatus.APPROVED },
          select: {
            id: true,
            comments: { select: { author: { select: { campus: true } } } },
          },
        },
        _count: { select: { memberships: true, posts: true } },
      },
    });
    const memberships =
      user.role === UserRole.STUDENT
        ? await this.prisma.connectMembership.findMany({
            where: { studentId: user.id },
            select: { groupId: true },
          })
        : [];
    const joined = new Set(memberships.map((item) => item.groupId));
    return groups.map((group) => {
      const mainMembers = group.memberships.filter(
        (m) => m.student.campus === Campus.MAIN,
      ).length;
      const branchMembers = group.memberships.filter(
        (m) => m.student.campus === Campus.BRANCH,
      ).length;
      const crossPosts = group.posts.filter((post) => {
        const campuses = new Set(
          post.comments.map((comment) => comment.author.campus),
        );
        return campuses.has(Campus.MAIN) && campuses.has(Campus.BRANCH);
      }).length;
      const { posts, _count } = group;
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        joined: joined.has(group.id),
        stats: {
          mainMembers,
          branchMembers,
          approvedPosts: posts.length,
          comments: posts.reduce(
            (total, post) => total + post.comments.length,
            0,
          ),
          crossCampusPosts: crossPosts,
          crossCampusPercent: posts.length
            ? Math.round((crossPosts / posts.length) * 100)
            : 0,
          pendingPosts:
            user.role === UserRole.TEACHER
              ? _count.posts - posts.length
              : undefined,
        },
      };
    });
  }

  async getGroup(id: string, user: AuthenticatedUser) {
    const group = await this.prisma.connectGroup.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { student: { select: userCard } },
          orderBy: { joinedAt: 'asc' },
        },
        posts: {
          where:
            user.role === UserRole.TEACHER
              ? undefined
              : {
                  OR: [
                    { status: ConnectPostStatus.APPROVED },
                    { authorId: user.id, status: ConnectPostStatus.PENDING },
                  ],
                },
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: userCard },
            comments: {
              orderBy: { createdAt: 'asc' },
              include: { author: { select: userCard } },
            },
            reactions: { select: { studentId: true, emoji: true } },
          },
        },
        _count: { select: { memberships: true } },
      },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');
    const approvedPosts = group.posts.filter(
      (post) => post.status === ConnectPostStatus.APPROVED,
    );
    const crossCampusPosts = approvedPosts.filter((post) => {
      const campuses = new Set(
        post.comments.map((comment) => comment.author.campus),
      );
      return campuses.has(Campus.MAIN) && campuses.has(Campus.BRANCH);
    }).length;
    return {
      ...group,
      joined:
        user.role === UserRole.STUDENT &&
        group.memberships.some((m) => m.studentId === user.id),
      stats: {
        mainMembers: group.memberships.filter(
          (membership) => membership.student.campus === Campus.MAIN,
        ).length,
        branchMembers: group.memberships.filter(
          (membership) => membership.student.campus === Campus.BRANCH,
        ).length,
        approvedPosts: approvedPosts.length,
        comments: approvedPosts.reduce(
          (total, post) => total + post.comments.length,
          0,
        ),
        crossCampusPosts,
        crossCampusPercent: approvedPosts.length
          ? Math.round((crossCampusPosts / approvedPosts.length) * 100)
          : 0,
      },
      members: group.memberships.map((m) => ({
        ...m.student,
        joinedAt: m.joinedAt,
      })),
      posts: group.posts.map((post) => {
        const { reactions, ...postDetails } = post;
        return {
          ...postDetails,
          reacted: reactions.some((reaction) => reaction.studentId === user.id),
          reactionCount: reactions.length,
        };
      }),
      memberships: undefined,
    };
  }

  createGroup(dto: SaveConnectGroupDto) {
    return this.prisma.connectGroup.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  async updateGroup(id: string, dto: SaveConnectGroupDto) {
    await this.requireGroup(id);
    return this.prisma.connectGroup.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  async deleteGroup(id: string) {
    await this.requireGroup(id);
    await this.prisma.connectGroup.delete({ where: { id } });
    return { success: true };
  }

  async join(groupId: string, user: AuthenticatedUser) {
    if (!user.campus)
      throw new BadRequestException('Tài khoản học sinh chưa được gán cơ sở');
    await this.requireGroup(groupId);
    try {
      await this.prisma.connectMembership.create({
        data: { groupId, studentId: user.id },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('Em đã tham gia nhóm này');
      throw error;
    }
    return { joined: true };
  }

  async leave(groupId: string, user: AuthenticatedUser) {
    const result = await this.prisma.connectMembership.deleteMany({
      where: { groupId, studentId: user.id },
    });
    if (!result.count)
      throw new BadRequestException('Em chưa tham gia nhóm này');
    return { joined: false };
  }

  async createPost(
    groupId: string,
    dto: ConnectPostDto,
    user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.STUDENT) await this.requireMember(groupId, user.id);
    else await this.requireGroup(groupId);
    const imageUrls = [...new Set([...(dto.imageUrls ?? []), ...(dto.imageUrl ? [dto.imageUrl] : [])])];
    if (!dto.body.trim() && !imageUrls.length)
      throw new BadRequestException('Bài viết cần có nội dung hoặc hình ảnh');
    return this.prisma.connectPost.create({
      data: {
        groupId,
        authorId: user.id,
        body: dto.body.trim(),
        imageUrl: dto.imageUrl?.trim() || null,
        imageUrls,
        ...(user.role === UserRole.TEACHER
          ? {
              status: ConnectPostStatus.APPROVED,
              reviewedById: user.id,
              reviewedAt: new Date(),
            }
          : {}),
      },
      include: { author: { select: userCard } },
    });
  }

  pendingPosts() {
    return this.prisma.connectPost.findMany({
      where: { status: ConnectPostStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        group: { select: { id: true, name: true } },
        author: { select: userCard },
      },
    });
  }

  async approvePost(id: string, user: AuthenticatedUser) {
    const post = await this.prisma.connectPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    if (post.status === ConnectPostStatus.APPROVED) return post;
    return this.prisma.connectPost.update({
      where: { id },
      data: {
        status: ConnectPostStatus.APPROVED,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  }

  async deletePost(id: string) {
    const result = await this.prisma.connectPost.deleteMany({ where: { id } });
    if (!result.count) throw new NotFoundException('Không tìm thấy bài viết');
    return { success: true };
  }

  async comment(
    postId: string,
    dto: ConnectCommentDto,
    user: AuthenticatedUser,
  ) {
    const post = await this.requirePost(postId);
    if (post.status !== ConnectPostStatus.APPROVED)
      throw new BadRequestException('Chỉ có thể bình luận bài đã được duyệt');
    if (user.role === UserRole.STUDENT)
      await this.requireMember(post.groupId, user.id);
    if (dto.parentId) {
      const parent = await this.prisma.connectComment.findFirst({
        where: { id: dto.parentId, postId },
        select: { id: true, parentId: true },
      });
      if (!parent) throw new NotFoundException('Không tìm thấy bình luận cần trả lời');
      if (parent.parentId)
        throw new BadRequestException('Chỉ hỗ trợ trả lời trực tiếp một cấp');
    }
    return this.prisma.connectComment.create({
      data: {
        postId,
        authorId: user.id,
        parentId: dto.parentId ?? null,
        body: dto.body.trim(),
      },
      include: { author: { select: userCard } },
    });
  }

  async deleteComment(id: string) {
    const result = await this.prisma.connectComment.deleteMany({
      where: { id },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy bình luận');
    return { success: true };
  }

  async toggleReaction(postId: string, user: AuthenticatedUser) {
    const post = await this.requirePost(postId);
    if (post.status !== ConnectPostStatus.APPROVED)
      throw new BadRequestException(
        'Chỉ có thể tương tác với bài đã được duyệt',
      );
    await this.requireMember(post.groupId, user.id);
    const existing = await this.prisma.connectReaction.findUnique({
      where: { postId_studentId: { postId, studentId: user.id } },
    });
    if (existing)
      await this.prisma.connectReaction.delete({
        where: { postId_studentId: { postId, studentId: user.id } },
      });
    else
      await this.prisma.connectReaction.create({
        data: { postId, studentId: user.id },
      });
    return { reacted: !existing };
  }

  private async requireMember(groupId: string, studentId: string) {
    const membership = await this.prisma.connectMembership.findUnique({
      where: { groupId_studentId: { groupId, studentId } },
    });
    if (!membership)
      throw new ForbiddenException('Hãy tham gia nhóm trước khi tương tác');
    return membership;
  }

  private async requireGroup(id: string) {
    const group = await this.prisma.connectGroup.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');
    return group;
  }

  private async requirePost(id: string) {
    const post = await this.prisma.connectPost.findUnique({
      where: { id },
      select: { id: true, groupId: true, status: true },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return post;
  }
}
