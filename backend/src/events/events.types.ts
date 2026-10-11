import { Campus, EventStatus, RegistrationStatus } from '@prisma/client';

export type EventListItem = {
  id: string;
  title: string;
  slug: string;
  description: string;
  objective: string | null;
  coverImageUrl: string | null;
  startAt: Date;
  endAt: Date;
  location: string;
  deliveryMode: string | null;
  targetGrades: string[];
  targetCampuses: Campus[];
  status: EventStatus;
  participantCount: number;
  campusCounts: { MAIN: number; BRANCH: number };
  currentRegistration: RegistrationStatus | null;
  satisfaction: number | null;
  baselineSurveyId: string;
};

export type StudentEventListItem = Omit<
  EventListItem,
  'participantCount' | 'campusCounts' | 'satisfaction' | 'baselineSurveyId'
>;
