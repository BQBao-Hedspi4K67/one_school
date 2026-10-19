import 'dotenv/config';
import {
  Campus,
  Prisma,
  PrismaClient,
  QuestionType,
  SurveyType,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();
const batchSize = 200;
const targets = [
  { key: 'TRUNG_THU', title: 'Trung Thu', count: 1913 },
  { key: '10_10', title: '10/10', count: 1913 },
  { key: 'BAN_CHI_HUY_CHI_DOI', title: 'Gặp mặt Ban Chỉ huy Chi đội', count: 110 },
] as const;

type SurveyWithQuestions = Prisma.SurveyGetPayload<{
  include: {
    questions: { orderBy: { order: 'asc' } };
    responses: { select: { studentId: true } };
  };
}>;

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

function choice<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function optionsFor(question: SurveyWithQuestions['questions'][number]) {
  if (!Array.isArray(question.options)) return [];
  return question.options
    .filter(
      (option): option is string | number =>
        typeof option === 'string' || typeof option === 'number',
    )
    .map(String);
}

function createValue(question: SurveyWithQuestions['questions'][number]) {
  const options = optionsFor(question);
  if (question.type === QuestionType.OPEN_TEXT) return undefined;
  if (question.type === QuestionType.SINGLE_CHOICE) {
    if (options.length < 2) throw new Error(`Câu ${question.order}: thiếu phương án chọn.`);
    return choice(options);
  }
  if (question.type === QuestionType.MULTIPLE_CHOICE) {
    if (options.length < 2) throw new Error(`Câu ${question.order}: thiếu phương án chọn nhiều.`);
    const selected = shuffle([...options]);
    const selectedCount = 1 + Math.floor(Math.random() * Math.min(3, options.length));
    return selected.slice(0, selectedCount);
  }
  if (question.type === QuestionType.RATING) {
    const numericOptions = options.map(Number).filter(Number.isFinite);
    if (numericOptions.length < 2) throw new Error(`Câu ${question.order}: thang điểm không hợp lệ.`);
    return choice(numericOptions);
  }
  throw new Error(`Câu ${question.order}: loại câu hỏi chưa được hỗ trợ.`);
}

async function main() {
  const [database] = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT current_database() AS name
  `;
  if (database?.name !== 'ai_education') {
    throw new Error(`Dừng để an toàn: database hiện tại là ${database?.name ?? 'không xác định'}, không phải ai_education.`);
  }

  const students = await prisma.user.findMany({
    where: { role: UserRole.STUDENT },
    select: { id: true, campus: true },
  });
  if (students.length !== 1913 || students.some((student) => !student.campus)) {
    throw new Error(`Cần đúng 1913 học sinh đã gắn campus; hiện có ${students.length}.`);
  }

  const allSurveys = await prisma.survey.findMany({
    include: {
      questions: { orderBy: { order: 'asc' } },
      responses: { select: { studentId: true } },
    },
  });
  const plans = targets.map((target) => {
    const matches = allSurveys.filter((survey) =>
      survey.title.toLocaleLowerCase('vi').includes(target.title.toLocaleLowerCase('vi')),
    );
    if (matches.length !== 1) {
      throw new Error(`Cần tìm thấy đúng một khảo sát ${target.title}; hiện tìm thấy ${matches.length}.`);
    }
    const survey = matches[0];
    if (survey.type !== SurveyType.BASELINE || !survey.published) {
      throw new Error(`Khảo sát ${target.title} phải là khảo sát trước đã công bố.`);
    }
    if (survey.responses.length > target.count) {
      throw new Error(`Khảo sát ${target.title} đã có ${survey.responses.length} phản hồi, vượt mục tiêu ${target.count}.`);
    }
    const unansweredOpenText = survey.questions.filter(
      (question) => question.type === QuestionType.OPEN_TEXT && question.required,
    );
    if (unansweredOpenText.length) {
      throw new Error(`Khảo sát ${target.title} có câu tự luận bắt buộc, không thể bỏ trống.`);
    }
    if (!survey.questions.length || survey.questions.some((question) => !question.required && question.type !== QuestionType.OPEN_TEXT)) {
      throw new Error(`Cấu hình câu hỏi khảo sát ${target.title} cần được xem lại trước khi sinh phản hồi.`);
    }
    return { target, survey };
  });

  console.log(`Database: ${database.name}; học sinh: ${students.length}.`);
  for (const { target, survey } of plans) {
    console.log(`${survey.title}: ${survey.responses.length}/${target.count} phản hồi hiện có.`);
    console.log(
      `  ${survey.questions.map((question) => `C${question.order} ${question.type}${question.type === QuestionType.OPEN_TEXT ? ' (sẽ để trống)' : ''}`).join(' | ')}`,
    );
  }
  if (!process.argv.includes('--apply')) {
    console.log('Chế độ kiểm tra: chưa ghi phản hồi. Dùng --apply để thực thi.');
    return;
  }

  const results = await prisma.$transaction(async (tx) => {
    const inserted: Array<{ title: string; responseCount: number; answersCount: number; campus: Record<Campus, number> }> = [];
    for (const { target, survey } of plans) {
      const existingIds = new Set(survey.responses.map((response) => response.studentId));
      const need = target.count - existingIds.size;
      const candidates = shuffle(students.filter((student) => !existingIds.has(student.id)));
      if (candidates.length < need) throw new Error(`Không đủ học sinh chưa trả lời khảo sát ${target.title}.`);
      const selectedStudents = candidates.slice(0, need);
      let answersCount = 0;

      for (let start = 0; start < selectedStudents.length; start += batchSize) {
        const batch = selectedStudents.slice(start, start + batchSize);
        await tx.response.createMany({
          data: batch.map((student) => ({
            surveyId: survey.id,
            eventId: survey.eventId,
            studentId: student.id,
          })),
        });
        const createdResponses = await tx.response.findMany({
          where: {
            surveyId: survey.id,
            studentId: { in: batch.map((student) => student.id) },
          },
          select: { id: true, studentId: true },
        });
        const responseIdByStudent = new Map(
          createdResponses.map((response) => [response.studentId, response.id]),
        );
        const answers: Array<{
          responseId: string;
          questionId: string;
          value: Prisma.InputJsonValue;
        }> = [];
        for (const student of batch) {
          const responseId = responseIdByStudent.get(student.id);
          if (!responseId) throw new Error(`Không đọc lại được phản hồi của học sinh ${student.id}.`);
          for (const question of survey.questions) {
            if (question.type === QuestionType.OPEN_TEXT) continue;
            const value = createValue(question);
            if (value !== undefined) {
              answers.push({
                responseId,
                questionId: question.id,
                value: value as Prisma.InputJsonValue,
              });
            }
          }
        }
        if (answers.length) {
          const result = await tx.answer.createMany({ data: answers });
          answersCount += result.count;
        }
      }

      const [responseCount, openTextAnswerCount, campusCounts] = await Promise.all([
        tx.response.count({ where: { surveyId: survey.id } }),
        tx.answer.count({
          where: { response: { surveyId: survey.id }, question: { type: QuestionType.OPEN_TEXT } },
        }),
        tx.response.groupBy({
          by: ['studentId'],
          where: { surveyId: survey.id },
        }),
      ]);
      if (responseCount !== target.count || openTextAnswerCount !== 0) {
        throw new Error(`Kiểm tra sau khi ghi thất bại với khảo sát ${target.title}; transaction sẽ rollback.`);
      }
      const campusByStudent = new Map(students.map((student) => [student.id, student.campus]));
      const campus = { MAIN: 0, BRANCH: 0 };
      for (const response of campusCounts) {
        const responseCampus = campusByStudent.get(response.studentId);
        if (responseCampus) campus[responseCampus] += 1;
      }
      inserted.push({ title: survey.title, responseCount, answersCount, campus });
    }
    return inserted;
  });

  for (const result of results) {
    console.log(`${result.title}: ${result.responseCount} phản hồi; ${result.answersCount} đáp án mới; MAIN=${result.campus.MAIN}, BRANCH=${result.campus.BRANCH}.`);
  }
  console.log('Đã xác nhận cả ba khảo sát không có câu trả lời tự luận.');
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.slice(0, 1500));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
