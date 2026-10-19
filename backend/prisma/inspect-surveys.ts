import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [database] = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT current_database() AS name
  `;
  const [mainStudents, branchStudents] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.STUDENT, campus: 'MAIN' } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, campus: 'BRANCH' } }),
  ]);
  const surveys = await prisma.survey.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      type: true,
      published: true,
      eventId: true,
      closedAt: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          prompt: true,
          type: true,
          required: true,
          options: true,
          criterion: { select: { name: true } },
          _count: { select: { answers: true } },
        },
      },
      _count: { select: { responses: true } },
      responses: { select: { student: { select: { campus: true } } } },
    },
  });
  console.log(JSON.stringify({
    database: database?.name,
    studentCounts: { MAIN: mainStudents, BRANCH: branchStudents },
    surveys: surveys.map((survey) => ({
      id: survey.id,
      title: survey.title,
      type: survey.type,
      published: survey.published,
      eventId: survey.eventId,
      closedAt: survey.closedAt,
      responseCount: survey._count.responses,
      campusResponses: survey.responses.reduce(
        (counts, response) => {
          if (response.student.campus) counts[response.student.campus] += 1;
          return counts;
        },
        { MAIN: 0, BRANCH: 0 },
      ),
      questions: survey.questions.map((question) => ({
        id: question.id,
        order: question.order,
        prompt: question.prompt,
        type: question.type,
        required: question.required,
        options: question.options,
        criterion: question.criterion.name,
        answeredCount: question._count.answers,
      })),
    })),
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
