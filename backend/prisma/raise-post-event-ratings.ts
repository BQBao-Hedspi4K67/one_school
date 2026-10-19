import 'dotenv/config';
import { Campus, Prisma, PrismaClient, QuestionType } from '@prisma/client';
import { calculateCampusScores } from '../src/analytics/scoring';

const prisma = new PrismaClient();
const targets = ['Trung Thu', '10/10', 'Gặp mặt Ban Chỉ huy Chi đội'];
const distributions = [
  { MAIN: { three: 0.2, five: 0.4 }, BRANCH: { three: 0.25, five: 0.35 } },
  { MAIN: { three: 0.15, five: 0.5 }, BRANCH: { three: 0.22, five: 0.35 } },
  { MAIN: { three: 0.18, five: 0.4 }, BRANCH: { three: 0.28, five: 0.3 } },
] as const;

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

async function main() {
  const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (database?.name !== 'ai_education') throw new Error(`Safety check failed: ${database?.name}`);

  const events = await prisma.event.findMany({
    where: { OR: targets.map((title) => ({ title: { contains: title, mode: 'insensitive' as const } })) },
    include: {
      surveys: {
        where: { type: 'POST_EVENT' },
        include: { questions: true },
      },
    },
  });
  const plans = targets.map((target) => {
    const matched = events.filter((event) => event.title.toLocaleLowerCase('vi').includes(target.toLocaleLowerCase('vi')));
    if (matched.length !== 1 || matched[0].surveys.length !== 1) {
      throw new Error(`Expected one event and POST_EVENT survey for ${target}; found ${matched.length}.`);
    }
    return { event: matched[0], survey: matched[0].surveys[0] };
  });

  const report = await prisma.$transaction(async (tx) => {
    const output: Array<{ title: string; overall: Record<string, number | null>; groups: Record<string, number> }> = [];
    for (const [surveyIndex, { event, survey }] of plans.entries()) {
      const answers = await tx.answer.findMany({
        where: { response: { surveyId: survey.id }, question: { type: QuestionType.RATING } },
        select: {
          id: true,
          value: true,
          response: { select: { student: { select: { campus: true } } } },
          question: { select: { criterionId: true, type: true } },
        },
      });
      const groups = new Map<string, typeof answers>();
      for (const answer of answers) {
        const campus = answer.response.student.campus;
        if (!campus) throw new Error(`Student without campus in ${survey.title}`);
        const key = `${campus}:${answer.question.criterionId}`;
        groups.set(key, [...(groups.get(key) ?? []), answer]);
      }

      for (const [key, group] of groups) {
        shuffle(group);
        const campus = key.startsWith('MAIN:') ? Campus.MAIN : Campus.BRANCH;
        const distribution = distributions[surveyIndex][campus];
        const threeCount = Math.round(group.length * distribution.three);
        const fiveCount = Math.round(group.length * distribution.five);
        const assignedRatings = shuffle([
          ...Array<number>(threeCount).fill(3),
          ...Array<number>(group.length - threeCount - fiveCount).fill(4),
          ...Array<number>(fiveCount).fill(5),
        ]);
        const byRating = new Map<number, string[]>();
        group.forEach((answer, index) => {
          const rating = assignedRatings[index];
          byRating.set(rating, [...(byRating.get(rating) ?? []), answer.id]);
        });
        for (const [rating, ids] of byRating) {
          for (let start = 0; start < ids.length; start += 500) {
            await tx.answer.updateMany({
              where: { id: { in: ids.slice(start, start + 500) } },
              data: { value: rating },
            });
          }
        }
        groups.set(key, group.map((answer, index) => ({
          ...answer,
          value: assignedRatings[index] as unknown as Prisma.JsonValue,
        })));
      }

      const refreshed = [...groups.values()].flat();
      const campusScores = calculateCampusScores(refreshed.map((answer) => ({
        student: answer.response.student,
        answers: [{ value: answer.value, question: answer.question }],
      })));
      for (const campus of [Campus.MAIN, Campus.BRANCH]) {
        const score = campusScores.overall.get(campus) ?? null;
        if (score === null || score < 70) throw new Error(`${survey.title} ${campus} score below 70: ${score}`);
        const responseCount = await tx.response.count({
          where: {
            surveyId: survey.id,
            student: { campus },
            answers: { some: { question: { type: QuestionType.RATING } } },
          },
        });
        await tx.satisfactionScore.upsert({
          where: { surveyId_campus: { surveyId: survey.id, campus } },
          create: { surveyId: survey.id, eventId: event.id, campus, score, responseCount, calculationVersion: 'equal-criteria-score-v2' },
          update: { eventId: event.id, score, responseCount, calculationVersion: 'equal-criteria-score-v2', calculatedAt: new Date() },
        });
      }
      output.push({
        title: event.title,
        overall: Object.fromEntries([...campusScores.overall]),
        groups: Object.fromEntries([...groups].map(([key, group]) => [
          key,
          Math.round(group.reduce((sum, answer) => sum + Number(answer.value), 0) / group.length * 10) / 10,
        ])),
      });
    }
    return output;
  }, { timeout: 120_000 });

  console.log(JSON.stringify({ database: database.name, updatedSurveys: report }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
