import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function assertLocalTestDatabase() {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) throw new Error('DATABASE_URL chưa được cấu hình');

  const databaseUrl = new URL(configuredUrl);
  const databaseName = databaseUrl.pathname.replace(/^\//, '');
  if (
    !['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname) ||
    databaseName !== 'ai_education'
  ) {
    throw new Error(
      'Từ chối xóa dữ liệu: db:reset chỉ chạy với database ai_education trên máy local.',
    );
  }
}

async function clean() {
  assertLocalTestDatabase();
  console.log('Đang xóa toàn bộ dữ liệu của database local ai_education...');

  const counts = await prisma.$transaction(async (tx) => {
    const answers = await tx.answer.deleteMany({});
    const responses = await tx.response.deleteMany({});
    const scores = await tx.satisfactionScore.deleteMany({});
    const analyses = await tx.aiAnalysis.deleteMany({});
    const participants = await tx.eventParticipant.deleteMany({});
    const questions = await tx.question.deleteMany({});
    const criteria = await tx.criterion.deleteMany({});
    const cycles = await tx.improvementCycle.deleteMany({});
    const events = await tx.event.deleteMany({});
    const surveys = await tx.survey.deleteMany({});
    const articles = await tx.article.deleteMany({});
    const sessions = await tx.authSession.deleteMany({});
    const users = await tx.user.deleteMany({});

    return {
      answers: answers.count,
      responses: responses.count,
      scores: scores.count,
      analyses: analyses.count,
      participants: participants.count,
      questions: questions.count,
      criteria: criteria.count,
      cycles: cycles.count,
      events: events.count,
      surveys: surveys.count,
      articles: articles.count,
      sessions: sessions.count,
      users: users.count,
    };
  });

  console.table(counts);
  console.log('Đã xóa dữ liệu trong toàn bộ bảng ứng dụng.');
  console.log('Tạo lại tài khoản qua màn hình đăng ký; không chạy seed nếu muốn test từ dữ liệu trống.');
}

clean()
  .catch((error: unknown) => {
    console.error('Không thể reset database:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
