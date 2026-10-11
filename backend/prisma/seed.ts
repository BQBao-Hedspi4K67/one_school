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

  const articles = [
    {
      category: 'AI trong giáo dục',
      title: 'AI trong giáo dục: Từ công cụ đến trải nghiệm học tập',
      slug: 'ai-trong-giao-duc',
      description:
        'Những cách tiếp cận thực tế để ứng dụng AI có trách nhiệm trong lớp học.',
      content: [
        'AI có thể hỗ trợ giáo viên và người học khi được triển khai với mục tiêu rõ ràng, dữ liệu phù hợp và sự minh bạch. Công nghệ không thay thế sự quan tâm của thầy cô; nó giúp nhà trường lắng nghe và phản hồi tốt hơn.',
        '# Bắt đầu từ nhu cầu thật',
        'Một ứng dụng hữu ích nên giải quyết một khó khăn cụ thể: tổng hợp phản hồi, nhận ra chủ đề lặp lại hoặc giúp giáo viên nhìn thấy nơi cần hỗ trợ. Dữ liệu cần được kiểm tra trước khi đưa ra quyết định.',
        '# Con người luôn ở trung tâm',
        'Giáo viên xem xét kết quả, bổ sung bối cảnh và quyết định bước tiếp theo. Học sinh cần biết ý kiến của mình được sử dụng ra sao, đồng thời thông tin cá nhân phải được bảo vệ.',
      ].join('\n\n'),
      publishedAt: new Date('2026-09-24T08:00:00.000Z'),
    },
    {
      category: 'Cộng đồng học đường',
      title: 'Kết nối học sinh giữa hai cơ sở bắt đầu từ những điều nhỏ',
      slug: 'ket-noi-hoc-sinh-hai-co-so',
      description:
        'Một hoạt động chung ý nghĩa có thể mở ra cơ hội làm quen, chia sẻ và học hỏi lẫn nhau.',
      content: [
        'Một ngôi trường có nhiều cơ sở vẫn có thể là một cộng đồng thống nhất. Những cuộc gặp gỡ được chuẩn bị chu đáo giúp học sinh nhận ra các bạn ở cơ sở khác cũng có nhiều trải nghiệm và mối quan tâm gần gũi.',
        '# Thiết kế hoạt động để mọi người cùng tham gia',
        'Nhóm nhỏ, nhiệm vụ hợp tác và vai trò luân phiên giúp mỗi bạn có cơ hội đóng góp. Hoạt động không cần cầu kỳ; điều quan trọng là tạo không gian an toàn để học sinh chủ động trò chuyện và cùng hoàn thành mục tiêu.',
        '# Lắng nghe sau hoạt động',
        'Một vài câu hỏi ngắn sau chương trình giúp nhà trường biết điều gì hiệu quả và điều gì cần thay đổi. Phản hồi ấy là điểm khởi đầu cho hoạt động kết nối tiếp theo.',
      ].join('\n\n'),
      publishedAt: new Date('2026-09-21T08:00:00.000Z'),
    },
    {
      category: 'Tiếng nói học sinh',
      title: 'Vì sao phản hồi của học sinh quan trọng?',
      slug: 'phan-hoi-hoc-sinh-quan-trong',
      description:
        'Chia sẻ trung thực giúp nhà trường hiểu trải nghiệm học tập từ góc nhìn của chính người học.',
      content: [
        'Mỗi học sinh nhìn thấy một phần khác nhau của đời sống học đường. Khi nhiều góc nhìn được lắng nghe, nhà trường có thêm căn cứ để nhận biết điều đang làm tốt và những nơi cần quan tâm hơn.',
        '# Chia sẻ cụ thể và tôn trọng',
        'Hãy mô tả trải nghiệm của mình bằng những ví dụ rõ ràng. Không có câu trả lời nào cần phải giống nhau; sự khác biệt giúp bức tranh chung đầy đủ hơn.',
        '# Phản hồi tạo nên thay đổi',
        'Ý kiến được tổng hợp để tìm ra chủ đề chung, không nhằm so sánh hay đánh giá từng học sinh. Những thay đổi phù hợp sẽ được trao đổi cùng thầy cô và cộng đồng.',
      ].join('\n\n'),
      publishedAt: new Date('2026-09-18T08:00:00.000Z'),
    },
    {
      category: 'Học tập tích cực',
      title: 'Cùng xây dựng môi trường học tập tích cực',
      slug: 'moi-truong-hoc-tap-tich-cuc',
      description:
        'Sự tôn trọng, hợp tác và cảm giác được thuộc về giúp mỗi học sinh phát huy khả năng của mình.',
      content: [
        'Một môi trường học tập tích cực được tạo nên từ những hành động hằng ngày: chào đón bạn mới, chia sẻ tài liệu, lắng nghe khi làm việc nhóm và tôn trọng sự khác nhau.',
        '# Hợp tác thay vì cạnh tranh',
        'Khi học sinh cùng giải quyết một nhiệm vụ, mỗi bạn có thể đóng góp điểm mạnh riêng. Giáo viên có thể tạo cơ hội để các nhóm thay đổi thành viên và cùng học hỏi.',
        '# Để mọi tiếng nói được đón nhận',
        'Quy tắc trao đổi rõ ràng giúp học sinh mạnh dạn đặt câu hỏi và đề xuất ý tưởng. Cảm giác an toàn là nền tảng để các em tham gia tích cực hơn.',
      ].join('\n\n'),
      publishedAt: new Date('2026-09-15T08:00:00.000Z'),
    },
    {
      category: 'ONE SCHOOL',
      title: 'Từ khảo sát đến hành động cùng ONE SCHOOL',
      slug: 'tu-khao-sat-den-hanh-dong',
      description:
        'Khảo sát, hoạt động kết nối và phản hồi sau sự kiện tạo nên một vòng cải thiện liên tục.',
      content: [
        'ONE SCHOOL giúp nhà trường thu thập phản hồi theo tiêu chí và cơ sở, từ đó nhìn rõ hơn trải nghiệm chung của học sinh. Mỗi kết quả là dữ liệu tham khảo để giáo viên cân nhắc hoạt động phù hợp.',
        '# Một vòng lặp dễ hiểu',
        'Học sinh chia sẻ ý kiến, giáo viên xem số liệu tổng hợp và lựa chọn hoạt động. Sau chương trình, khảo sát tiếp theo giúp cả cộng đồng nhận biết điều gì đã thay đổi.',
        '# Giáo viên là người quyết định',
        'Phân tích tự động chỉ hỗ trợ việc đọc dữ liệu. Giáo viên luôn xem xét bối cảnh thực tế trước khi quyết định; thông tin cá nhân của học sinh không được gửi cho mô hình AI.',
      ].join('\n\n'),
      publishedAt: new Date('2026-09-12T08:00:00.000Z'),
    },
  ];
  for (const article of articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: {
        ...article,
        published: true,
      },
      create: {
        ...article,
        published: true,
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
