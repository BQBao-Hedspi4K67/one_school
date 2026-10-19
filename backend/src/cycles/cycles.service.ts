import { Injectable } from '@nestjs/common';
import { QuestionType, SurveyType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateCycleDto } from './dto/create-cycle.dto';

const BASELINE_QUESTIONS = [
  {
    prompt: 'Bạn mong muốn tham gia loại hoạt động nào nhất?',
    options: ['Giao lưu giữa hai cơ sở', 'Trải nghiệm thực hành', 'Cuộc thi', 'Văn nghệ hoặc thể thao', 'Thiện nguyện', 'Ý kiến khác'],
  },
  {
    prompt: 'Bạn muốn hoạt động được tổ chức theo hình thức nào?',
    options: ['Trực tiếp tại một cơ sở', 'Luân phiên giữa hai cơ sở', 'Trực tuyến', 'Kết hợp trực tiếp và trực tuyến'],
  },
  {
    prompt: 'Bạn muốn hoạt động diễn ra trong khoảng thời gian nào?',
    options: ['Một buổi', 'Một ngày', 'Nhiều buổi', 'Định kỳ theo câu lạc bộ'],
  },
  {
    prompt: 'Bạn mong muốn nhận được điều gì nhất sau hoạt động?',
    options: ['Kết nối bạn mới', 'Học kiến thức hoặc kỹ năng', 'Có trải nghiệm thực tế', 'Thư giãn và giải trí', 'Đóng góp cho cộng đồng'],
  },
] as const;

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCycleDto, user: AuthenticatedUser) {
    const title = dto.title.trim();
    return this.prisma.$transaction(async (tx) => {
      const survey = await tx.survey.create({
        data: {
          type: SurveyType.BASELINE,
          title: `Khảo sát đầu vào: ${title}`,
          description: `Khảo sát trước chương trình “${title}”.`,
          published: true,
          teacherId: user.id,
          criteria: {
            create: BASELINE_QUESTIONS.map((_, index) => ({
              name: `Câu hỏi ${index + 1}`,
              description: 'Nhóm nội bộ để lưu câu hỏi khảo sát mong muốn, không dùng để tính điểm.',
              weight: 1,
              isScored: false,
              order: index + 1,
            })),
          },
        },
        include: { criteria: { orderBy: { order: 'asc' } } },
      });
      await tx.question.createMany({
        data: survey.criteria.map((criterion, index) => ({
          surveyId: survey.id,
          criterionId: criterion.id,
          order: index + 1,
          prompt: BASELINE_QUESTIONS[index].prompt,
          type: QuestionType.SINGLE_CHOICE,
          required: true,
          options: BASELINE_QUESTIONS[index].options,
        })),
      });
      const cycle = await tx.improvementCycle.create({
        data: {
          title,
          teacherId: user.id,
          baselineSurveyId: survey.id,
        },
      });
      return { ...cycle, baselineSurvey: { ...survey, questionsCount: BASELINE_QUESTIONS.length } };
    });
  }
}
