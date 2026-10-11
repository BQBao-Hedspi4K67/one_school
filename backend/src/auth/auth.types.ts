import { Campus, UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  campus: Campus | null;
  avatarUrl: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
}
