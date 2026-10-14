import {
  Campus,
  PrismaClient,
  QuestionType,
  RegistrationStatus,
  SurveyType,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('DemoPassword123!', 12);

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher.demo@example.com' },
    update: {
      name: 'Nguyễn Văn An',
      role: UserRole.TEACHER,
      campus: null,
    },
    create: {
      name: 'Nguyễn Văn An',
      email: 'teacher.demo@example.com',
      passwordHash,
      role: UserRole.TEACHER,
    },
  });

  await prisma.user.upsert({
    where: { email: 'student.main.demo@example.com' },
    update: {
      name: 'Minh Trần',
      role: UserRole.STUDENT,
      campus: Campus.MAIN,
    },
    create: {
      name: 'Minh Trần',
      email: 'student.main.demo@example.com',
      passwordHash,
      role: UserRole.STUDENT,
      campus: Campus.MAIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'student.branch.demo@example.com' },
    update: {
      name: 'Lan Phạm',
      role: UserRole.STUDENT,
      campus: Campus.BRANCH,
    },
    create: {
      name: 'Lan Phạm',
      email: 'student.branch.demo@example.com',
      passwordHash,
      role: UserRole.STUDENT,
      campus: Campus.BRANCH,
    },
  });

  const mainStudent = await prisma.user.findUniqueOrThrow({
    where: { email: 'student.main.demo@example.com' },
  });
  const branchStudent = await prisma.user.findUniqueOrThrow({
    where: { email: 'student.branch.demo@example.com' },
  });

  const baseline = await prisma.survey.findFirst({
    where: { type: SurveyType.BASELINE, eventId: null },
  });
  const baselineSurvey =
    baseline ??
    (await prisma.survey.create({
      data: {
        type: SurveyType.BASELINE,
        teacherId: teacher.id,
        title: 'Khảo sát kết nối hai cơ sở',
        description:
          'Đo lường trải nghiệm học tập và mức độ kết nối giữa hai cơ sở.',
        published: true,
      },
    }));
  const criteria = [
    ['Môi trường học tập', 'Không gian và điều kiện hỗ trợ việc học.', 0.25],
    ['Kết nối cộng đồng', 'Cơ hội giao lưu, chia sẻ giữa hai cơ sở.', 0.35],
    ['Hoạt động ngoại khóa', 'Mức độ đa dạng và phù hợp của hoạt động.', 0.2],
    ['Hỗ trợ học tập', 'Khả năng tiếp cận sự hỗ trợ khi cần.', 0.2],
  ] as const;
  const criterionRecords = [];
  for (const [index, [name, description, weight]] of criteria.entries()) {
    const existing = await prisma.criterion.findFirst({
      where: { surveyId: baselineSurvey.id, order: index + 1 },
    });
    criterionRecords.push(
      existing ??
        (await prisma.criterion.create({
          data: {
            surveyId: baselineSurvey.id,
            name,
            description,
            order: index + 1,
            weight,
          },
        })),
    );
  }
  const questions = [];
  for (const [index, criterion] of criterionRecords.entries()) {
    const existing = await prisma.question.findFirst({
      where: { surveyId: baselineSurvey.id, order: index + 1 },
    });
    questions.push(
      existing ??
        (await prisma.question.create({
          data: {
            surveyId: baselineSurvey.id,
            criterionId: criterion.id,
            order: index + 1,
            prompt: `Bạn đánh giá ${criterion.name.toLowerCase()} như thế nào?`,
            type: QuestionType.RATING,
            options: [1, 2, 3, 4, 5],
          },
        })),
    );
  }

  const event = await prisma.event.upsert({
    where: { slug: 'hoat-dong-ket-noi-hai-co-so' },
    update: { status: 'COMPLETED' },
    create: {
      title: 'Hoạt động kết nối hai cơ sở',
      slug: 'hoat-dong-ket-noi-hai-co-so',
      description:
        'Chia sẻ phương pháp học tập và trải nghiệm giữa học sinh hai cơ sở.',
      objective: 'Cải thiện tiêu chí kết nối cộng đồng.',
      startAt: new Date('2026-09-15T08:00:00.000Z'),
      endAt: new Date('2026-09-15T11:00:00.000Z'),
      location: 'Trường THCS Đông Ngạc',
      targetGrades: ['6', '7', '8', '9'],
      targetCampuses: [Campus.MAIN, Campus.BRANCH],
      baselineSurveyId: baselineSurvey.id,
      status: 'COMPLETED',
      teacherId: teacher.id,
    },
  });
  const postSurvey = await prisma.survey.upsert({
    where: { eventId_type: { eventId: event.id, type: SurveyType.POST_EVENT } },
    update: { published: true },
    create: {
      eventId: event.id,
      teacherId: teacher.id,
      type: SurveyType.POST_EVENT,
      title: 'Khảo sát sau hoạt động kết nối',
      description: 'Đánh giá hiệu quả sau hoạt động kết nối hai cơ sở.',
      published: true,
    },
  });
  for (const [index, criterion] of criterionRecords.entries()) {
    const postCriterion = await prisma.criterion.findFirst({
      where: { surveyId: postSurvey.id, order: index + 1 },
    });
    const targetCriterion =
      postCriterion ??
      (await prisma.criterion.create({
        data: {
          surveyId: postSurvey.id,
          name: criterion.name,
          description: criterion.description,
          order: index + 1,
          weight: criterion.weight,
        },
      }));
    const existingQuestion = await prisma.question.findFirst({
      where: { surveyId: postSurvey.id, order: index + 1 },
    });
    if (!existingQuestion) {
      await prisma.question.create({
        data: {
          surveyId: postSurvey.id,
          criterionId: targetCriterion.id,
          order: index + 1,
          prompt: `Sau hoạt động, bạn đánh giá ${criterion.name.toLowerCase()} như thế nào?`,
          type: QuestionType.RATING,
          options: [1, 2, 3, 4, 5],
        },
      });
    }
  }

  for (const student of [mainStudent, branchStudent]) {
    await prisma.eventParticipant.upsert({
      where: {
        eventId_studentId: { eventId: event.id, studentId: student.id },
      },
      update: { status: RegistrationStatus.CONFIRMED },
      create: {
        eventId: event.id,
        studentId: student.id,
        status: RegistrationStatus.CONFIRMED,
      },
    });
  }
  const responseValues = [
    [mainStudent.id, [4, 4, 4, 5]],
    [branchStudent.id, [3, 2, 3, 4]],
  ] as const;
  for (const [studentId, values] of responseValues) {
    const response = await prisma.response.upsert({
      where: { surveyId_studentId: { surveyId: baselineSurvey.id, studentId } },
      update: {},
      create: {
        surveyId: baselineSurvey.id,
        studentId,
        answers: {
          create: questions.map((question, index) => ({
            questionId: question.id,
            value: values[index],
          })),
        },
      },
    });
    await prisma.satisfactionScore.upsert({
      where: {
        surveyId_campus: {
          surveyId: baselineSurvey.id,
          campus: studentId === mainStudent.id ? Campus.MAIN : Campus.BRANCH,
        },
      },
      update: {
        score: studentId === mainStudent.id ? 81.3 : 60.6,
        responseCount: 1,
      },
      create: {
        surveyId: baselineSurvey.id,
        campus: studentId === mainStudent.id ? Campus.MAIN : Campus.BRANCH,
        score: studentId === mainStudent.id ? 81.3 : 60.6,
        responseCount: 1,
      },
    });
    const postQuestions = await prisma.question.findMany({
      where: { surveyId: postSurvey.id },
      orderBy: { order: 'asc' },
    });
    await prisma.response.upsert({
      where: { surveyId_studentId: { surveyId: postSurvey.id, studentId } },
      update: {},
      create: {
        surveyId: postSurvey.id,
        eventId: event.id,
        studentId,
        answers: {
          create: postQuestions.map((question, index) => ({
            questionId: question.id,
            value: Math.min(5, values[index] + 1),
          })),
        },
      },
    });
  }
  await prisma.aiAnalysis.deleteMany({
    where: { id: 'seed-baseline-analysis' },
  });

  await prisma.article.deleteMany({
    where: {
      slug: {
        in: [
          'ai-trong-giao-duc',
          'ket-noi-hoc-sinh-hai-co-so',
          'phan-hoi-hoc-sinh-quan-trong',
          'moi-truong-hoc-tap-tich-cuc',
          'tu-khao-sat-den-hanh-dong',
        ],
      },
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
