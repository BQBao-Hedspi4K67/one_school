import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE_NAME } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './auth.types';

type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withCookie(response, await this.auth.register(dto));
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withCookie(response, await this.auth.login(dto));
  }

  @Post('refresh')
  async refresh(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.getRefreshToken(request);
    return this.withCookie(response, await this.auth.refresh(refreshToken));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(this.getRefreshToken(request));
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
    return { message: 'Đã đăng xuất' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  private withCookie(
    response: Response,
    result: {
      user: AuthenticatedUser;
      accessToken: string;
      refreshToken: string;
    },
  ) {
    response.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      this.cookieOptions(),
    );
    return { user: result.user, accessToken: result.accessToken };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: 'lax' as const,
      path: '/api/auth',
    };
  }

  private getRefreshToken(request: RequestWithCookies): string | undefined {
    const cookies = request.cookies as unknown as Record<
      string,
      string | undefined
    >;
    const token = cookies?.[REFRESH_COOKIE_NAME];
    return typeof token === 'string' ? token : undefined;
  }
}
