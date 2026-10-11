import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clean() {
  console.log('Bắt đầu làm sạch database, chỉ giữ lại bảng User...');

  // Xóa các bảng liên quan theo thứ tự ràng buộc khóa ngoại
  const deletedAnswers = await prisma.answer.deleteMany({});
  console.log(`- Đã xóa ${deletedAnswers.count} câu trả lời (Answer)`);

  const deletedResponses = await prisma.response.deleteMany({});
  console.log(`- Đã xóa ${deletedResponses.count} phản hồi khảo sát (Response)`);

  const deletedScores = await prisma.satisfactionScore.deleteMany({});
  console.log(`- Đã xóa ${deletedScores.count} điểm hài lòng (SatisfactionScore)`);

  const deletedAnalyses = await prisma.aiAnalysis.deleteMany({});
  console.log(`- Đã xóa ${deletedAnalyses.count} phân tích AI (AiAnalysis)`);

  const deletedParticipants = await prisma.eventParticipant.deleteMany({});
  console.log(`- Đã xóa ${deletedParticipants.count} người tham gia sự kiện (EventParticipant)`);

  const deletedQuestions = await prisma.question.deleteMany({});
  console.log(`- Đã xóa ${deletedQuestions.count} câu hỏi (Question)`);

  const deletedCriteria = await prisma.criterion.deleteMany({});
  console.log(`- Đã xóa ${deletedCriteria.count} tiêu chí (Criterion)`);

  const deletedEvents = await prisma.event.deleteMany({});
  console.log(`- Đã xóa ${deletedEvents.count} sự kiện (Event)`);

  const deletedSurveys = await prisma.survey.deleteMany({});
  console.log(`- Đã xóa ${deletedSurveys.count} khảo sát (Survey)`);

  const userCount = await prisma.user.count();
  console.log(`=> Giữ lại nguyên vẹn ${userCount} tài khoản người dùng trong bảng User.`);
  console.log('Hoàn tất làm sạch database!');
}

clean()
  .catch((e) => {
    console.error('Lỗi khi làm sạch DB:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
