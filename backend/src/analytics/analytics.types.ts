import { Campus, SurveyType } from '@prisma/client';
import type { AnalysisKind } from './analysis-kind';

export type DashboardFilters = {
  surveyId?: string;
  eventId?: string;
  surveyType?: SurveyType;
  kind?: AnalysisKind;
};

export type AnalysisTarget = {
  surveyId?: string;
  eventId?: string;
};

export type CampusScore = {
  main: number | null;
  branch: number | null;
  gap: number | null;
};

export type ImprovementCycleStepStatus =
  'COMPLETED' | 'IN_PROGRESS' | 'WAITING';

export type AiEvaluation = {
  analysisId: string | null;
  status: string | null;
  updatedAt: string | null;
  summary: string | null;
  recommendations: string[];
};

export type ImprovementCycle = {
  id: string; // event id
  title: string;
  status: 'DRAFT' | 'UPCOMING' | 'LIVE' | 'COMPLETED';
  startAt: string;
  endAt: string;
  currentStep: number; // 1..5
  steps: {
    step1: {
      name: string;
      status: ImprovementCycleStepStatus;
      surveyId: string;
      surveyTitle: string;
      responsesCount: number;
    };
    step2: {
      name: string;
      status: ImprovementCycleStepStatus;
      analysisId: string | null;
      summary: string | null;
      recommendations: string[];
      recommendationsCount: number;
      updatedAt: string | null;
    };
    step3: {
      name: string;
      status: ImprovementCycleStepStatus;
      eventId: string;
      eventTitle: string;
      coverImageUrl: string | null;
      participantsCount: number;
    };
    step4: {
      name: string;
      status: ImprovementCycleStepStatus;
      surveyId: string | null;
      surveyTitle: string | null;
      responsesCount: number;
    };
    /** Bước 05: AI đánh giá hiệu quả sau khi toàn bộ chu trình kết thúc */
    step5: {
      name: string;
      status: ImprovementCycleStepStatus;
      analysisId: string | null;
      summary: string | null;
      recommendationsCount: number;
      updatedAt: string | null;
    };
  };
  metrics: {
    beforeScore: CampusScore;
    afterScore: CampusScore;
    gapChange: number | null;
    aiEvaluation: AiEvaluation;
  };
};

export type DashboardResponse = {
  kpiStats: {
    openSurveysCount: number;
    totalPublishedSurveysCount: number;
    totalStudentsCount: number;
    respondedStudentsCount: number;
    responseRate: number;
    pendingAiCount: number;
    completedEventsCount: number;
    liveEventsCount: number;
    upcomingEventsCount: number;
  };
  allSurveysCriterionComparison: Array<{
    criterionName: string;
    mainScore: number | null;
    branchScore: number | null;
    gap: number | null;
    responseCount: Record<Campus, number>;
  }>;
  cycles: ImprovementCycle[];
  filters: {
    surveys: Array<{
      id: string;
      title: string;
      type: SurveyType;
      eventId: string | null;
      eventTitle: string | null;
    }>;
    events: Array<{ id: string; title: string }>;
    selected: DashboardFilters;
  };
  summary: {
    mainScore: number | null;
    branchScore: number | null;
    completionRate: number | null;
    eventCount: number;
    mainParticipants: number;
    branchParticipants: number;
  };
  criterionComparison: Array<{
    criterionId: string;
    criterionName: string;
    mainScore: number | null;
    branchScore: number | null;
    gap: number | null;
    responseCount: Record<Campus, number>;
  }>;
  questionBreakdown: Array<{
    questionId: string;
    questionText: string;
    criterionName: string;
    mainDistribution: Array<{ label: string; count: number }>;
    branchDistribution: Array<{ label: string; count: number }>;
  }>;
  participation: {
    main: number;
    branch: number;
    completion: { main: number | null; branch: number | null };
  };
  aiInsight: {
    analysisId: string | null;
    status: string | null;
    /** OVERVIEW: dashboard tổng thể · BASELINE/EFFECTIVENESS: các bước trong chu trình */
    kind: AnalysisKind | null;
    title: string | null;
    summary: string | null;
    recommendations: string[];
    updatedAt: string | null;
    canRetry: boolean;
  };
  effectiveness: {
    available: boolean;
    before: CampusScore;
    after: CampusScore;
    changeByCampus: CampusScore;
    byCriterion: Array<{
      criterionName: string;
      before: CampusScore;
      after: CampusScore;
      changeByCampus: CampusScore;
    }>;
  };
};
