import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestionType, SurveyType, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { UpdateSurveyDto } from './dto/update-survey.dto';
import { QuestionDto } from './dto/question.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';

const surveyInclude = {
  criteria: { orderBy: { order: 'asc' as const } },
  questions: {
    orderBy: { order: 'asc' as const },
    include: { criterion: true },
  },
  _count: { select: { responses: true } },
} satisfies Prisma.SurveyInclude;

type SurveyWithDetails = Prisma.SurveyGetPayload<{
  include: typeof surveyInclude;
}>;

@Injectable()
export class SurveysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, eventId?: string) {
    if (user.role === UserRole.STUDENT && !user.campus)
      throw new ForbiddenException('Tài khoản chưa được gắn với cơ sở');
    const surveys = await this.prisma.survey.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        ...(user.role === UserRole.TEACHER ? { teacherId: user.id } : {}),
        ...(user.role === UserRole.STUDENT
          ? {
              published: true,
              OR: [
                { eventId: null },
                {
                  event: {
                    status: { in: ['UPCOMING', 'LIVE', 'COMPLETED'] },
                    targetCampuses: { has: this.requireCampus(user) },
                    participants: {
                      some: {
                        studentId: user.id,
                        status: 'CONFIRMED',
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: surveyInclude,
      orderBy: { createdAt: 'desc' },
    });
    if (user.role === UserRole.TEACHER)
      return Promise.all(
        surveys.map(async (survey) =>
          this.toSurvey(
            {
              ...survey,
              criteria: await this.ensureFourCriteria(survey.id),
            },
            user,
          ),
        ),
      );
    const submitted = new Set(
      (
        await this.prisma.response.findMany({
          where: { studentId: user.id, surveyId: { in: surveys.map(({ id }) => id) } },
          select: { surveyId: true },
        })
      ).map(({ surveyId }) => surveyId),
    );
    return surveys.map((survey) =>
      this.toSurvey(survey, user, submitted.has(survey.id)),
    );
  }

  async get(id: string, user: AuthenticatedUser) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: surveyInclude,
    });
    if (!survey) throw new NotFoundException('Không tìm thấy khảo sát');
    await this.assertAccess(survey, user);
    const criteria =
      user.role === UserRole.TEACHER
        ? await this.ensureFourCriteria(survey.id)
        : survey.criteria;
    const hasResponded =
      user.role === UserRole.STUDENT
        ? Boolean(
            await this.prisma.response.findUnique({
              where: {
                surveyId_studentId: { surveyId: id, studentId: user.id },
              },
              select: { id: true },
            }),
          )
        : false;
    return this.toSurvey({ ...survey, criteria }, user, hasResponded);
  }

  async create(dto: CreateSurveyDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.TEACHER)
      throw new ForbiddenException('Chỉ giáo viên mới có thể tạo khảo sát');
    if (dto.type === SurveyType.POST_EVENT)
      throw new BadRequestException(
        'Khảo sát sau sự kiện phải được tạo từ một sự kiện',
      );
    return this.prisma.survey
      .create({
        data: {
          type: dto.type,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          teacherId: user.id,
          criteria: {
            create: Array.from({ length: 4 }, (_, index) => ({
              name: `Tiêu chí ${index + 1}`,
              order: index + 1,
            })),
          },
        },
        include: surveyInclude,
      })
      .then((survey) => this.toSurvey(survey, user));
  }

  async createForEvent(eventId: string, user: AuthenticatedUser) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { baselineSurvey: { include: { criteria: true } } },
    });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện');
    if (event.teacherId !== user.id)
      throw new ForbiddenException('Bạn không có quyền quản lý sự kiện này');
    if (!event.baselineSurvey || !event.baselineSurvey.published)
      throw new BadRequestException(
        'Sự kiện phải có khảo sát baseline đã công bố',
      );
    const existing = await this.prisma.survey.findUnique({
      where: { eventId_type: { eventId, type: SurveyType.POST_EVENT } },
    });
    if (existing) return this.get(existing.id, user);
    return this.prisma.survey
      .create({
        data: {
          eventId,
          teacherId: user.id,
          type: SurveyType.POST_EVENT,
          title: `Khảo sát sau sự kiện: ${event.title}`,
          description: 'Đánh giá hiệu quả sau sự kiện.',
          criteria: {
            create: Array.from({ length: 4 }, (_, index) => {
              const source = event.baselineSurvey?.criteria.find(
                (criterion) => criterion.order === index + 1,
              );
              return {
                name: `Tiêu chí ${index + 1}`,
                description: source?.description ?? null,
                order: index + 1,
              };
            }),
          },
        },
        include: surveyInclude,
      })
      .then((survey) => this.toSurvey(survey, user));
  }

  async update(id: string, dto: UpdateSurveyDto, user: AuthenticatedUser) {
    const survey = await this.getOwned(id, user.id);
    await this.assertStructureUnlocked(survey.id);
    return this.prisma.survey
      .update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
        },
        include: surveyInclude,
      })
      .then((result) => this.toSurvey(result, user));
  }

  async publish(id: string, user: AuthenticatedUser) {
    const survey = await this.getOwned(id, user.id);
    await this.validateSurvey(survey.id);
    return this.prisma.survey
      .update({
        where: { id },
        data: { published: true },
        include: surveyInclude,
      })
      .then((result) => this.toSurvey(result, user));
  }

  async addQuestion(id: string, dto: QuestionDto, user: AuthenticatedUser) {
    const survey = await this.getOwned(id, user.id);
    await this.assertStructureUnlocked(survey.id);
    await this.assertQuestionDefinition(id, dto);
    const order = await this.prisma.question.count({ where: { surveyId: id } });
    return this.prisma.question.create({
      data: {
        surveyId: id,
        criterionId: dto.criterionId,
        order: order + 1,
        prompt: dto.prompt.trim(),
        type: dto.type,
        required: dto.required,
        options: dto.options ?? Prisma.JsonNull,
      },
    });
  }

  async updateQuestion(id: string, dto: QuestionDto, user: AuthenticatedUser) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Không tìm thấy câu hỏi');
    await this.getOwned(question.surveyId, user.id);
    await this.assertStructureUnlocked(question.surveyId);
    await this.assertQuestionDefinition(question.surveyId, dto);
    return this.prisma.question.update({
      where: { id },
      data: {
        criterionId: dto.criterionId,
        prompt: dto.prompt.trim(),
        type: dto.type,
        required: dto.required,
        options: dto.options ?? Prisma.JsonNull,
      },
    });
  }

  async removeQuestion(id: string, user: AuthenticatedUser) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Không tìm thấy câu hỏi');
    await this.getOwned(question.surveyId, user.id);
    await this.assertStructureUnlocked(question.surveyId);
    await this.prisma.question.delete({ where: { id } });
    return { message: 'Đã xóa câu hỏi' };
  }

  async reorderQuestions(
    id: string,
    dto: ReorderQuestionsDto,
    user: AuthenticatedUser,
  ) {
    const survey = await this.getOwned(id, user.id);
    await this.assertStructureUnlocked(survey.id);
    const questions = await this.prisma.question.findMany({
      where: { surveyId: id },
      select: { id: true },
    });
    if (
      questions.length !== dto.questionIds.length ||
      new Set(dto.questionIds).size !== questions.length ||
      questions.some((question) => !dto.questionIds.includes(question.id))
    ) {
      throw new BadRequestException('Danh sách sắp xếp câu hỏi không hợp lệ');
    }
    await this.prisma.$transaction(
      dto.questionIds.map((questionId, index) =>
        this.prisma.question.update({
          where: { id: questionId },
          data: { order: -(index + 1) },
        }),
      ),
    );
    await this.prisma.$transaction(
      dto.questionIds.map((questionId, index) =>
        this.prisma.question.update({
          where: { id: questionId },
          data: { order: index + 1 },
        }),
      ),
    );
    return this.get(id, user);
  }

  async submit(id: string, dto: SubmitResponseDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.STUDENT)
      throw new ForbiddenException('Chỉ học sinh mới có thể gửi khảo sát');
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!survey || !survey.published)
      throw new NotFoundException(
        'Khảo sát chưa được công bố hoặc không tồn tại',
      );
    if (survey.type === SurveyType.POST_EVENT && survey.eventId) {
      const registration = await this.prisma.eventParticipant.findUnique({
        where: {
          eventId_studentId: { eventId: survey.eventId, studentId: user.id },
        },
      });
      if (!registration || registration.status !== 'CONFIRMED')
        throw new ForbiddenException(
          'Bạn cần được xác nhận tham gia sự kiện trước khi làm khảo sát',
        );
    }
    const byId = new Map(
      survey.questions.map((question) => [question.id, question]),
    );
    const submitted = new Map(
      dto.answers.map((answer) => [answer.questionId, answer.value]),
    );
    for (const question of survey.questions) {
      if (question.required && !submitted.has(question.id))
        throw new BadRequestException(`Vui lòng trả lời: ${question.prompt}`);
      if (submitted.has(question.id))
        this.validateAnswer(question, submitted.get(question.id));
    }
    if (
      submitted.size > survey.questions.length ||
      [...submitted.keys()].some((questionId) => !byId.has(questionId))
    )
      throw new BadRequestException('Danh sách câu trả lời không hợp lệ');
    try {
      return await this.prisma.response.create({
        data: {
          surveyId: id,
          eventId: survey.eventId,
          studentId: user.id,
          answers: {
            create: [...submitted.entries()].map(([questionId, value]) => ({
              questionId,
              value: value as Prisma.InputJsonValue,
            })),
          },
        },
        include: { answers: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Bạn đã hoàn thành khảo sát này');
      throw error;
    }
  }

  private async getOwned(id: string, teacherId: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: surveyInclude,
    });
    if (!survey) throw new NotFoundException('Không tìm thấy khảo sát');
    if (teacherId !== survey.teacherId)
      throw new ForbiddenException('Bạn không có quyền quản lý khảo sát này');
    return survey;
  }

  private async ensureFourCriteria(surveyId: string) {
    const criteria = await this.prisma.criterion.findMany({
      where: { surveyId },
      orderBy: { order: 'asc' },
    });
    const existingOrders = new Set(criteria.map((criterion) => criterion.order));
    const missing = Array.from({ length: 4 }, (_, index) => index + 1)
      .filter((order) => !existingOrders.has(order))
      .map((order) => ({
        surveyId,
        name: `Tiêu chí ${order}`,
        order,
      }));

    if (missing.length) {
      await this.prisma.criterion.createMany({
        data: missing,
        skipDuplicates: true,
      });
      return this.prisma.criterion.findMany({
        where: { surveyId },
        orderBy: { order: 'asc' },
      });
    }

    return criteria;
  }

  private async assertAccess(
    survey: { id: string; published: boolean; eventId: string | null },
    user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.TEACHER) {
      await this.getOwned(survey.id, user.id);
    } else if (!survey.published)
      throw new ForbiddenException('Khảo sát chưa được công bố');
    else if (!user.campus)
      throw new ForbiddenException('Tài khoản chưa được gắn với cơ sở');
    else if (survey.eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: survey.eventId },
        select: {
          status: true,
          targetCampuses: true,
          participants: {
            where: { studentId: user.id, status: 'CONFIRMED' },
            select: { studentId: true },
          },
        },
      });
      if (
        !event ||
        event.status === 'DRAFT' ||
        !event.targetCampuses.includes(user.campus) ||
        (survey.eventId &&
          !event.participants.some(
            (participant) => participant.studentId === user.id,
          ))
      )
        throw new ForbiddenException('Bạn không có quyền xem khảo sát này');
    }
  }

  private async assertStructureUnlocked(id: string) {
    const responseCount = await this.prisma.response.count({
      where: { surveyId: id },
    });
    if (responseCount > 0)
      throw new ConflictException(
        'Khảo sát đã có phản hồi và không thể sửa cấu trúc',
      );
  }

  private requireCampus(user: AuthenticatedUser) {
    if (!user.campus)
      throw new ForbiddenException('Tài khoản chưa được gắn với cơ sở');
    return user.campus;
  }

  private async validateSurvey(id: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: { criteria: true, questions: true },
    });
    if (
      !survey ||
      survey.criteria.length === 0 ||
      survey.questions.length === 0
    )
      throw new BadRequestException(
        'Khảo sát cần có ít nhất một tiêu chí và một câu hỏi',
      );
  }

  private async assertQuestionDefinition(surveyId: string, dto: QuestionDto) {
    const criterion = await this.prisma.criterion.findFirst({
      where: { id: dto.criterionId, surveyId },
    });
    if (!criterion)
      throw new BadRequestException(
        'Câu hỏi phải thuộc một tiêu chí trong survey',
      );
    const optionTypes: QuestionType[] = [
      QuestionType.SINGLE_CHOICE,
      QuestionType.MULTIPLE_CHOICE,
      QuestionType.RATING,
    ];
    if (
      optionTypes.includes(dto.type) &&
      (!dto.options || dto.options.length < 2)
    )
      throw new BadRequestException(
        'Câu hỏi lựa chọn/rating cần ít nhất hai đáp án',
      );
    if (dto.options && new Set(dto.options).size !== dto.options.length)
      throw new BadRequestException('Các đáp án không được trùng nhau');
  }

  private validateAnswer(
    question: {
      type: QuestionType;
      options: Prisma.JsonValue | null;
      prompt: string;
    },
    value: unknown,
  ) {
    const options = Array.isArray(question.options) ? question.options : [];
    if (
      question.type === QuestionType.OPEN_TEXT &&
      (typeof value !== 'string' || value.trim().length > 2000)
    )
      throw new BadRequestException(
        `Câu trả lời cho "${question.prompt}" không hợp lệ`,
      );
    if (
      question.type === QuestionType.RATING &&
      (typeof value !== 'number' ||
        !options.some((option) => Number(option) === value))
    )
      throw new BadRequestException(
        `Câu trả lời cho "${question.prompt}" không hợp lệ`,
      );
    if (
      question.type === QuestionType.SINGLE_CHOICE &&
      (typeof value !== 'string' || !options.includes(value))
    )
      throw new BadRequestException(
        `Câu trả lời cho "${question.prompt}" không hợp lệ`,
      );
    if (
      question.type === QuestionType.MULTIPLE_CHOICE &&
      (!Array.isArray(value) ||
        value.length === 0 ||
        value.some(
          (item) => typeof item !== 'string' || !options.includes(item),
        ))
    )
      throw new BadRequestException(
        `Câu trả lời cho "${question.prompt}" không hợp lệ`,
      );
  }

  private toSurvey(
    survey: SurveyWithDetails,
    user: AuthenticatedUser,
    hasResponded = false,
  ) {
    const { _count, ...details } = survey;
    const normalizedDetails = {
      ...details,
      criteria: details.criteria.map((criterion) => ({
        ...criterion,
        name: `Tiêu chí ${criterion.order}`,
      })),
      questions: details.questions.map((question) => ({
        ...question,
        criterion: {
          ...question.criterion,
          name: `Tiêu chí ${question.criterion.order}`,
        },
      })),
    };
    return user.role === UserRole.TEACHER
      ? { ...normalizedDetails, responseCount: _count.responses }
      : { ...normalizedDetails, hasResponded };
  }
}
