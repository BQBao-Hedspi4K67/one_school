import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [database] = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT current_database() AS name
  `;
  const [students, events] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.STUDENT } }),
    prisma.event.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        status: true,
        targetCampuses: true,
        baselineSurvey: { select: { id: true, title: true } },
        participants: {
          select: { student: { select: { campus: true, role: true } } },
        },
        surveys: {
          where: { type: 'POST_EVENT' },
          select: {
            id: true,
            title: true,
            type: true,
            published: true,
            closedAt: true,
            _count: { select: { responses: true } },
            responses: { select: { student: { select: { campus: true } } } },
            questions: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                order: true,
                prompt: true,
                type: true,
                required: true,
                options: true,
                _count: { select: { answers: true } },
              },
            },
          },
        },
      },
    }),
  ]);
  console.log(JSON.stringify({
    database: database?.name,
    students,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      status: event.status,
      targetCampuses: event.targetCampuses,
      baselineSurvey: event.baselineSurvey.title,
      participantCount: event.participants.length,
      participantsByCampus: event.participants.reduce(
        (counts, participant) => {
          if (participant.student.role === UserRole.STUDENT && participant.student.campus) {
            counts[participant.student.campus] += 1;
          }
          return counts;
        },
        { MAIN: 0, BRANCH: 0 },
      ),
      surveys: event.surveys.map((survey) => ({
        id: survey.id,
        title: survey.title,
        type: survey.type,
        published: survey.published,
        closedAt: survey.closedAt,
        responseCount: survey._count.responses,
        responsesByCampus: survey.responses.reduce(
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
          answeredCount: question._count.answers,
        })),
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
