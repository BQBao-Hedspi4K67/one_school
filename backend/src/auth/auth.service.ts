import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AccessTokenPayload,
  AuthenticatedUser,
  RefreshTokenPayload,
} from './auth.types';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  campus: true,
  avatarUrl: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    user: AuthenticatedUser;
    accessToken: string;
    refreshToken: string;
  }> {
    if (!dto.campus) {
      throw new UnauthorizedException('Học sinh cần chọn cơ sở');
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email này đã được sử dụng');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: UserRole.STUDENT,
        campus: dto.campus,
      },
      select: userSelect,
    });
    return this.issueSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.issueSession(user);
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken)
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: { user: { select: userSelect } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !this.matches(refreshToken, session.refreshTokenHash)
    ) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(session.user);
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          ignoreExpiration: true,
        },
      );
      await this.prisma.authSession.updateMany({
        where: { id: payload.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      return;
    }
  }

  private async issueSession(user: AuthenticatedUser) {
    const sessionId = randomUUID();
    const accessToken = await this.jwt.signAsync<AccessTokenPayload>({
      sub: user.id,
      role: user.role,
    });
    const refreshExpiresIn: JwtSignOptions['expiresIn'] =
      this.config.getOrThrow<JwtSignOptions['expiresIn']>(
        'JWT_REFRESH_EXPIRES_IN',
      );
    const refreshOptions: JwtSignOptions = {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    };
    const refreshToken = await this.jwt.signAsync<RefreshTokenPayload>(
      { sub: user.id, sessionId },
      refreshOptions,
    );
    const decoded = this.jwt.decode<{ exp?: number }>(refreshToken);
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hash(refreshToken),
        expiresAt: new Date(
          (decoded?.exp ?? Math.floor(Date.now() / 1000)) * 1000,
        ),
      },
    });
    return { user, accessToken, refreshToken };
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private matches(token: string, hash: string) {
    return this.hash(token) === hash;
  }
}
