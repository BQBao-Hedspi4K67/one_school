import 'dotenv/config';
import {
  Campus,
  Prisma,
  PrismaClient,
  QuestionType,
  RegistrationStatus,
  SurveyType,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();
const batchSize = 200;
const targets = [
  { title: 'Trung Thu', responseCount: 1913 },
  { title: '10/10', responseCount: 1913 },
  { title: 'Gặp mặt Ban Chỉ huy Chi đội', responseCount: 110 },
] as const;

type EventSurvey = Prisma.EventGetPayload<{
  include: {
    participants: { select: { studentId: true } };
    surveys: {
      where: { type: 'POST_EVENT' };
      include: {
        questions: { orderBy: { order: 'asc' } };
        responses: { select: { studentId: true } };
      };
    };
  };
}>;

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function stringOptions(question: EventSurvey['surveys'][number]['questions'][number]) {
  if (!Array.isArray(question.options)) return [];
  return question.options
    .filter(
      (value): value is string | number =>
        typeof value === 'string' || typeof value === 'number',
    )
    .map(String);
}

function randomAnswer(question: EventSurvey['surveys'][number]['questions'][number]) {
  if (question.type === QuestionType.OPEN_TEXT) return undefined;
  const options = stringOptions(question);
  if (question.type === QuestionType.SINGLE_CHOICE) {
    if (!options.length) throw new Error(`Câu ${question.order} chưa có phương án.`);
    return pick(options);
  }
  if (question.type === QuestionType.MULTIPLE_CHOICE) {
    if (!options.length) throw new Error(`Câu ${question.order} chưa có phương án.`);
    const shuffled = shuffle([...options]);
    const count = 1 + Math.floor(Math.random() * Math.min(shuffled.length, 3));
    return shuffled.slice(0, count);
  }
  if (question.type === QuestionType.RATING) {
    const values = options.map(Number).filter(Number.isFinite);
    if (!values.length) throw new Error(`Câu ${question.order} chưa có thang điểm hợp lệ.`);
    const preferred = values.filter((value) => value >= 3 && value <= 5);
    if (preferred.length) return pick(preferred.flatMap((value) => value === 3 ? [value] : [value, value]));
    return pick(values);
  }
  throw new Error(`Câu ${question.order} có loại không được hỗ trợ.`);
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
    throw new Error(`Cần đúng 1913 học sinh có campus; hiện có ${students.length}.`);
  }
  const studentsById = new Map(students.map((student) => [student.id, student]));

  const allEvents = await prisma.event.findMany({
    include: {
      participants: { select: { studentId: true } },
      surveys: {
        where: { type: SurveyType.POST_EVENT },
        include: {
          questions: { orderBy: { order: 'asc' } },
          responses: { select: { studentId: true } },
        },
      },
    },
  });
  const plans = targets.map((target) => {
    const matches = allEvents.filter((event) =>
      event.title.toLocaleLowerCase('vi').includes(target.title.toLocaleLowerCase('vi')),
    );
    if (matches.length !== 1) {
      throw new Error(`Cần đúng một sự kiện ${target.title}; hiện tìm thấy ${matches.length}.`);
    }
    const event = matches[0] as EventSurvey;
    if (event.surveys.length !== 1) {
      throw new Error(`Sự kiện ${target.title} cần đúng một khảo sát POST_EVENT; hiện có ${event.surveys.length}.`);
    }
    const survey = event.surveys[0];
    if (!survey.published || survey.eventId !== event.id) {
      throw new Error(`Khảo sát sau sự kiện ${survey.title} chưa công bố hoặc không khớp sự kiện.`);
    }
    if (!event.targetCampuses.includes(Campus.MAIN) || !event.targetCampuses.includes(Campus.BRANCH)) {
      throw new Error(`Sự kiện ${event.title} không mở cho cả hai campus.`);
    }
    const reserved = new Set([
      ...event.participants.map((participant) => participant.studentId),
      ...survey.responses.map((response) => response.studentId),
    ]);
    if ([...reserved].some((id) => !studentsById.has(id))) {
      throw new Error(`Sự kiện/khảo sát ${target.title} đã có người tham gia không phải học sinh hiện tại.`);
    }
    if (reserved.size > target.responseCount) {
      throw new Error(`Sự kiện/khảo sát ${target.title} có ${reserved.size} học sinh hiện có, vượt mục tiêu ${target.responseCount}.`);
    }
    if (!survey.questions.length) throw new Error(`Khảo sát ${survey.title} chưa có câu hỏi.`);
    const requiredTextQuestions = survey.questions.filter(
      (question) => question.type === QuestionType.OPEN_TEXT && question.required,
    );
    if (requiredTextQuestions.length) {
      throw new Error(`Khảo sát ${survey.title} có câu tự luận bắt buộc; dừng trước khi tạo dữ liệu.`);
    }
    return { target, event, survey, reserved };
  });

  console.log(`Database: ${database.name}; ${students.length} học sinh.`);
  for (const { target, event, survey } of plans) {
    console.log(
      `${event.title}: ${event.participants.length}/${target.responseCount} thành viên; ` +
      `${survey.responses.length}/${target.responseCount} phản hồi; ` +
      `${survey.questions.length} câu hỏi.`,
    );
    console.log(
      `  ${survey.questions.map((question) => `C${question.order} ${question.type}${question.type === QuestionType.OPEN_TEXT ? ' (để trống)' : ''}`).join(' | ')}`,
    );
  }
  if (!process.argv.includes('--apply')) {
    console.log('Chế độ kiểm tra: chưa thêm thành viên hoặc phản hồi. Dùng --apply để thực thi.');
    return;
  }

  const summaries = await prisma.$transaction(async (tx) => {
    const output: Array<{
      event: string;
      participants: number;
      responses: number;
      answersAdded: number;
      main: number;
      branch: number;
      openTextAnswers: number;
    }> = [];

    for (const { target, event, survey, reserved } of plans) {
      const selected = shuffle(students.filter((student) => !reserved.has(student.id)))
        .slice(0, target.responseCount - reserved.size);
      const selectedIds = [
        ...reserved,
        ...selected.map((student) => student.id),
      ];
      let answersAdded = 0;

      for (let start = 0; start < selectedIds.length; start += batchSize) {
        const batchIds = selectedIds.slice(start, start + batchSize);
        await tx.eventParticipant.createMany({
          data: batchIds.map((studentId) => ({
            eventId: event.id,
            studentId,
            status: RegistrationStatus.CONFIRMED,
          })),
          skipDuplicates: true,
        });
        await tx.response.createMany({
          data: batchIds.map((studentId) => ({
            surveyId: survey.id,
            eventId: event.id,
            studentId,
          })),
          skipDuplicates: true,
        });

        const responses = await tx.response.findMany({
          where: { surveyId: survey.id, studentId: { in: batchIds } },
          select: {
            id: true,
            studentId: true,
            answers: { select: { questionId: true } },
          },
        });
        const responseByStudent = new Map(
          responses.map((response) => [response.studentId, response]),
        );
        const newAnswers: Array<{
          responseId: string;
          questionId: string;
          value: Prisma.InputJsonValue;
        }> = [];
        for (const studentId of batchIds) {
          const response = responseByStudent.get(studentId);
          if (!response) throw new Error(`Thiếu phản hồi của học sinh ${studentId}.`);
          const existingQuestionIds = new Set(
            response.answers.map((answer) => answer.questionId),
          );
          for (const question of survey.questions) {
            if (
              question.type === QuestionType.OPEN_TEXT ||
              existingQuestionIds.has(question.id)
            ) {
              continue;
            }
            const value = randomAnswer(question);
            if (value !== undefined) {
              newAnswers.push({
                responseId: response.id,
                questionId: question.id,
                value: value as Prisma.InputJsonValue,
              });
            }
          }
        }
        if (newAnswers.length) {
          const result = await tx.answer.createMany({ data: newAnswers });
          answersAdded += result.count;
        }
      }

      const [participantCount, responseCount, openTextAnswers, participants] =
        await Promise.all([
          tx.eventParticipant.count({ where: { eventId: event.id } }),
          tx.response.count({ where: { surveyId: survey.id } }),
          tx.answer.count({
            where: {
              response: { surveyId: survey.id },
              question: { type: QuestionType.OPEN_TEXT },
            },
          }),
          tx.eventParticipant.findMany({
            where: { eventId: event.id },
            select: { studentId: true },
          }),
        ]);
      if (
        participantCount !== target.responseCount ||
        responseCount !== target.responseCount ||
        openTextAnswers !== 0
      ) {
        throw new Error(`Đối soát thất bại ở ${event.title}; transaction sẽ rollback.`);
      }
      const campusCounts: Record<Campus, number> = {
        [Campus.MAIN]: 0,
        [Campus.BRANCH]: 0,
      };
      for (const participant of participants) {
        const campus = studentsById.get(participant.studentId)?.campus;
        if (campus) campusCounts[campus] += 1;
      }
      output.push({
        event: event.title,
        participants: participantCount,
        responses: responseCount,
        answersAdded,
        main: campusCounts[Campus.MAIN],
        branch: campusCounts[Campus.BRANCH],
        openTextAnswers,
      });
    }
    return output;
  });

  for (const summary of summaries) {
    console.log(
      `${summary.event}: ${summary.participants} tham gia, ${summary.responses} phản hồi, ` +
      `${summary.answersAdded} đáp án mới; MAIN=${summary.main}, BRANCH=${summary.branch}; ` +
      `câu tự luận=${summary.openTextAnswers}.`,
    );
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.slice(0, 1500));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
