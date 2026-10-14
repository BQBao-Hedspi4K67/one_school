import { Campus, QuestionType, SurveyType } from '@prisma/client';

export type SurveyResults = {
  survey: {
    id: string;
    title: string;
    type: SurveyType;
    description: string | null;
    published: boolean;
    createdAt: string;
    responseCount: number;
    questionCount: number;
  };
  summary: {
    mainScore: number | null;
    branchScore: number | null;
    gap: number | null;
    completion: { main: number | null; branch: number | null };
    responseCount: { MAIN: number; BRANCH: number };
    studentCount: { MAIN: number; BRANCH: number };
    totalResponses: number;
  };
  criterionComparison: Array<{
    criterionId: string;
    criterionName: string;
    description: string | null;
    mainScore: number | null;
    branchScore: number | null;
    gap: number | null;
    responseCount: { MAIN: number; BRANCH: number };
  }>;
  questionBreakdown: Array<{
    questionId: string;
    questionText: string;
    type: QuestionType;
    criterionId: string;
    criterionName: string;
    options: string[];
    mainDistribution: Array<{ label: string; count: number }>;
    branchDistribution: Array<{ label: string; count: number }>;
    textAnswers: { MAIN: string[]; BRANCH: string[] };
  }>;
};
