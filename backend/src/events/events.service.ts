import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Campus,
  EventStatus,
  Prisma,
  RegistrationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventListItem, StudentEventListItem } from './events.types';
import { deriveEventStatus } from './event-status';

const eventInclude = {
  participants: {
    include: {
      student: { select: { id: true, name: true, email: true, campus: true } },
    },
  },
  scores: {
    select: { score: true },
    orderBy: { calculatedAt: 'desc' as const },
    take: 1,
  },
  surveys: {
    select: {
      id: true,
      type: true,
      title: true,
      published: true,
      _count: { select: { responses: true } },
    },
  },
  baselineSurvey: {
    select: {
      id: true,
      title: true,
      type: true,
      published: true,
      _count: { select: { responses: true } },
    },
  },
} satisfies Prisma.EventInclude;

type EventWithDetails = Prisma.EventGetPayload<{
  include: typeof eventInclude;
}>;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: EventQueryDto) {
    if (user.role === UserRole.STUDENT) {
      const campus = user.campus;
      if (!campus)
        throw new ForbiddenException('Tài khoản chưa được gắn với cơ sở');
      // Đồng bộ trạng thái theo thời gian trước khi lọc: sự kiện đã qua giờ
      // kết thúc phải rời khỏi luồng khám phá của học sinh.
      await this.syncStatusesByTime({
        status: { in: [EventStatus.UPCOMING, EventStatus.LIVE] },
        targetCampuses: { has: campus },
      });
      const events = await this.prisma.event.findMany({
        where: {
          status: { in: [EventStatus.UPCOMING, EventStatus.LIVE] },
          targetCampuses: { has: campus },
        },
        include: eventInclude,
        orderBy: { startAt: 'asc' },
      });
      return events.map((event) => this.toStudentListItem(event, user));
    }
    const where: Prisma.EventWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      teacherId: user.id,
    };
    await this.syncStatusesByTime({
      status: { in: [EventStatus.UPCOMING, EventStatus.LIVE] },
      teacherId: user.id,
    });
    const events = await this.prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy: { startAt: 'asc' },
    });
    return events.map((event) => this.toListItem(event, user));
  }

  async listStudentActivities(user: AuthenticatedUser) {
    if (!user.campus)
      throw new ForbiddenException('Tài khoản chưa được gắn với cơ sở');
    const registrations = await this.prisma.eventParticipant.findMany({
      where: { studentId: user.id },
      orderBy: { joinedAt: 'desc' },
      select: {
        eventId: true,
        status: true,
        joinedAt: true,
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            coverImageUrl: true,
            startAt: true,
            endAt: true,
            location: true,
            deliveryMode: true,
            targetGrades: true,
            targetCampuses: true,
            status: true,
            surveys: {
              where: { published: true },
              select: { id: true, type: true, title: true },
            },
          },
        },
      },
    });
    return registrations.map((registration) => ({
      ...registration,
      event: {
        ...registration.event,
        status: deriveEventStatus(registration.event),
      },
    }));
  }

  async getById(id: string, user: AuthenticatedUser) {
    await this.syncStatusesByTime({ id });
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện');
    this.assertCanView(event, user);
    return user.role === UserRole.STUDENT
      ? this.toStudentDetail(event, user)
      : this.toDetail(event, user);
  }

  async create(dto: CreateEventDto, user: AuthenticatedUser) {
    this.assertDateRange(dto.startAt, dto.endAt);
    const baselineSurvey = await this.prisma.survey.findFirst({
      where: {
        id: dto.baselineSurveyId,
        teacherId: user.id,
        type: 'BASELINE',
        eventId: null,
        published: true,
      },
      select: { id: true },
    });
    if (!baselineSurvey)
      throw new BadRequestException(
        'Cần chọn một khảo sát thực trạng đã công bố trước khi tạo sự kiện',
      );
    const linkedEvent = await this.prisma.event.findFirst({
      where: { baselineSurveyId: baselineSurvey.id },
      select: { id: true },
    });
    if (linkedEvent)
      throw new ConflictException(
        'Khảo sát thực trạng này đã được gắn với một sự kiện khác',
      );
    const event = await this.prisma.event.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        objective: dto.objective?.trim() || null,
        coverImageUrl: dto.coverImageUrl || null,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        location: dto.location.trim(),
        deliveryMode: dto.deliveryMode,
        targetGrades: dto.targetGrades
          .map((grade) => grade.trim())
          .filter(Boolean),
        targetCampuses: dto.targetCampuses,
        baselineSurveyId: baselineSurvey.id,
        slug: await this.createUniqueSlug(dto.title),
        teacherId: user.id,
      },
      include: eventInclude,
    });
    await this.prisma.improvementCycle.updateMany({
      where: { baselineSurveyId: baselineSurvey.id, eventId: null },
      data: { eventId: event.id },
    });
    return this.toDetail(event, user);
  }

  async update(id: string, dto: UpdateEventDto, user: AuthenticatedUser) {
    const existing = await this.getOwnedEvent(id, user.id);
    if (existing.status === EventStatus.COMPLETED) {
      throw new BadRequestException('Không thể sửa sự kiện đã hoàn thành');
    }
    const startAt = dto.startAt ?? existing.startAt.toISOString();
    const endAt = dto.endAt ?? existing.endAt.toISOString();
    this.assertDateRange(startAt, endAt);
    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...this.toData(dto),
        // Đổi lịch thì trạng thái phải theo lịch mới, không giữ nhãn cũ.
        ...(existing.status === EventStatus.DRAFT
          ? {}
          : {
              status: deriveEventStatus({
                status: EventStatus.UPCOMING,
                startAt: new Date(startAt),
                endAt: new Date(endAt),
              }),
            }),
        ...(dto.title
          ? { slug: await this.createUniqueSlug(dto.title, id) }
          : {}),
      },
      include: eventInclude,
    });
    return this.toDetail(event, user);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const event = await this.getOwnedEvent(id, user.id);
    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể xóa sự kiện bản nháp');
    }
    await this.prisma.event.delete({ where: { id } });
    return { message: 'Đã xóa bản nháp sự kiện' };
  }

  async publish(id: string, user: AuthenticatedUser) {
    const event = await this.getOwnedEvent(id, user.id);
    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Sự kiện này đã được công bố');
    }
    // Công bố xong là bám theo thời gian thực: sự kiện đặt lịch trong quá khứ
    // sẽ không bị gắn nhãn "Sắp diễn ra" mãi.
    const published = {
      status: EventStatus.UPCOMING,
      startAt: event.startAt,
      endAt: event.endAt,
    };
    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: deriveEventStatus(published) },
      include: eventInclude,
    });
    return this.toDetail(updated, user);
  }

  async join(id: string, user: AuthenticatedUser) {
    if (user.role !== UserRole.STUDENT || !user.campus)
      throw new ForbiddenException('Chỉ học sinh mới có thể đăng ký');
    await this.syncStatusesByTime({ id });
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (
      !event ||
      (event.status !== EventStatus.UPCOMING &&
        event.status !== EventStatus.LIVE)
    )
      throw new NotFoundException('Không tìm thấy sự kiện');
    if (!event.targetCampuses.includes(user.campus))
      throw new ForbiddenException('Sự kiện không mở cho cơ sở của bạn');
    try {
      const registration = await this.prisma.eventParticipant.create({
        data: {
          eventId: id,
          studentId: user.id,
          status: RegistrationStatus.CONFIRMED,
        },
      });
      return {
        status: registration.status,
        message: 'Đã tham gia sự kiện',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bạn đã gửi yêu cầu tham gia sự kiện này');
      }
      throw error;
    }
  }

  async updateRegistration(
    id: string,
    studentId: string,
    status: RegistrationStatus,
    user: AuthenticatedUser,
  ) {
    await this.getOwnedEvent(id, user.id);
    const registration = await this.prisma.eventParticipant.findUnique({
      where: { eventId_studentId: { eventId: id, studentId } },
    });
    if (!registration)
      throw new NotFoundException('Không tìm thấy yêu cầu tham gia');
    const updated = await this.prisma.eventParticipant.update({
      where: { eventId_studentId: { eventId: id, studentId } },
      data: { status },
      include: {
        student: {
          select: { id: true, name: true, email: true, campus: true },
        },
      },
    });
    return updated;
  }

  private async getOwnedEvent(id: string, teacherId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện');
    if (event.teacherId !== teacherId)
      throw new ForbiddenException('Bạn không có quyền quản lý sự kiện này');
    return event;
  }

  private assertCanView(event: EventWithDetails, user: AuthenticatedUser) {
    if (user.role === UserRole.TEACHER && event.teacherId !== user.id)
      throw new ForbiddenException('Bạn không có quyền xem sự kiện này');
    if (
      user.role === UserRole.STUDENT &&
      (event.status === EventStatus.DRAFT ||
        !user.campus ||
        !event.targetCampuses.includes(user.campus))
    ) {
      throw new ForbiddenException('Bạn không có quyền xem sự kiện này');
    }
  }

  private assertDateRange(startAt: string, endAt: string) {
    if (new Date(endAt) <= new Date(startAt))
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
  }

  private toData(
    dto: CreateEventDto | UpdateEventDto,
  ): Prisma.EventUpdateInput {
    const data: Prisma.EventUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined)
      data.description = dto.description.trim();
    if (dto.objective !== undefined)
      data.objective = dto.objective?.trim() || null;
    if (dto.coverImageUrl !== undefined)
      data.coverImageUrl = dto.coverImageUrl || null;
    if (dto.startAt !== undefined) data.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined) data.endAt = new Date(dto.endAt);
    if (dto.location !== undefined) data.location = dto.location.trim();
    if (dto.deliveryMode !== undefined) data.deliveryMode = dto.deliveryMode;
    if (dto.targetGrades !== undefined)
      data.targetGrades = [
        ...new Set(
          dto.targetGrades.map((grade) => grade.trim()).filter(Boolean),
        ),
      ];
    if (dto.targetCampuses !== undefined)
      data.targetCampuses = dto.targetCampuses;
    return data;
  }

  private async createUniqueSlug(title: string, excludeId?: string) {
    const base =
      title
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'event';
    let slug = base;
    let suffix = 2;
    while (
      await this.prisma.event.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      })
    )
      slug = `${base}-${suffix++}`;
    return slug;
  }

  /**
   * Cập nhật `status` lưu trong DB cho khớp với thời gian thực của sự kiện.
   * Nhờ vậy mọi bộ lọc/đếm theo `status` (học sinh, dashboard, analytics) đều
   * nhất quán với nhãn hiển thị "Sắp diễn ra / Đang diễn ra / Đã kết thúc".
   */
  private async syncStatusesByTime(where: Prisma.EventWhereInput) {
    const now = new Date();
    const events = await this.prisma.event.findMany({
      where,
      select: { id: true, status: true, startAt: true, endAt: true },
    });
    const stale = events.filter(
      (event) => deriveEventStatus(event, now) !== event.status,
    );
    if (!stale.length) return;
    await this.prisma.$transaction(
      stale.map((event) =>
        this.prisma.event.update({
          where: { id: event.id },
          data: { status: deriveEventStatus(event, now) },
        }),
      ),
    );
  }

  private toListItem(
    event: EventWithDetails,
    user: AuthenticatedUser,
  ): EventListItem {
    const counts = this.getCampusCounts(event);
    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      description: event.description,
      objective: event.objective,
      coverImageUrl: event.coverImageUrl,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.location,
      deliveryMode: event.deliveryMode,
      targetGrades: event.targetGrades,
      targetCampuses: event.targetCampuses,
      status: deriveEventStatus(event),
      participantCount: event.participants.filter(
        (item) => item.status === RegistrationStatus.CONFIRMED,
      ).length,
      campusCounts: counts,
      currentRegistration:
        event.participants.find((item) => item.studentId === user.id)?.status ??
        null,
      satisfaction: event.scores[0] ? Number(event.scores[0].score) : null,
      baselineSurveyId: event.baselineSurveyId,
    };
  }

  private toDetail(event: EventWithDetails, user: AuthenticatedUser) {
    return {
      ...this.toListItem(event, user),
      teacherId: event.teacherId,
      participants: event.participants,
      surveys: event.surveys.map(({ _count, ...survey }) => ({
        ...survey,
        responseCount: _count.responses,
      })),
      baselineSurvey: event.baselineSurvey
        ? {
            id: event.baselineSurvey.id,
            title: event.baselineSurvey.title,
            type: event.baselineSurvey.type,
            published: event.baselineSurvey.published,
            responseCount: event.baselineSurvey._count.responses,
          }
        : null,
    };
  }

  private toStudentListItem(
    event: EventWithDetails,
    user: AuthenticatedUser,
  ): StudentEventListItem {
    const {
      participantCount: _participantCount,
      campusCounts: _campusCounts,
      satisfaction: _satisfaction,
      baselineSurveyId: _baselineSurveyId,
      ...studentEvent
    } = this.toListItem(event, user);
    return studentEvent;
  }

  private toStudentDetail(event: EventWithDetails, user: AuthenticatedUser) {
    return {
      ...this.toStudentListItem(event, user),
      surveys: event.surveys.filter((survey) => survey.published),
    };
  }

  private getCampusCounts(event: EventWithDetails) {
    return event.participants.reduce(
      (counts, item) => {
        if (item.status === RegistrationStatus.CONFIRMED && item.student.campus)
          counts[item.student.campus]++;
        return counts;
      },
      { MAIN: 0, BRANCH: 0 },
    );
  }
}
