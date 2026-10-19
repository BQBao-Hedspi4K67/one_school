import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  ConnectCommentDto,
  ConnectPostDto,
  SaveConnectGroupDto,
  UpdateConnectPostDto,
} from './dto/connect.dto';
import { ConnectService } from './connect.service';
import { ConnectAiService } from './connect-ai.service';

@Controller('connect')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConnectController {
  constructor(
    private readonly connect: ConnectService,
    private readonly connectAi: ConnectAiService,
  ) {}

  @Get('insights')
  @Roles(UserRole.TEACHER)
  latestInsights() {
    return this.connectAi.latest();
  }

  @Post('insights')
  @Roles(UserRole.TEACHER)
  analyzeCommunity(@CurrentUser() user: AuthenticatedUser) {
    return this.connectAi.analyze(user);
  }

  @Get('groups/:id/insights')
  @Roles(UserRole.TEACHER)
  latestGroupInsights(@Param('id') id: string) {
    return this.connectAi.latest(id);
  }

  @Post('groups/:id/insights')
  @Roles(UserRole.TEACHER)
  analyzeGroup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.connectAi.analyze(user, id);
  }

  @Get('groups')
  listGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.connect.listGroups(user);
  }

  @Get('groups/:id')
  getGroup(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.connect.getGroup(id, user);
  }

  @Post('groups')
  @Roles(UserRole.TEACHER)
  createGroup(@Body() dto: SaveConnectGroupDto) {
    return this.connect.createGroup(dto);
  }

  @Patch('groups/:id')
  @Roles(UserRole.TEACHER)
  updateGroup(@Param('id') id: string, @Body() dto: SaveConnectGroupDto) {
    return this.connect.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  @Roles(UserRole.TEACHER)
  deleteGroup(@Param('id') id: string) {
    return this.connect.deleteGroup(id);
  }

  @Post('groups/:id/join')
  @Roles(UserRole.STUDENT)
  join(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.connect.join(id, user);
  }

  @Delete('groups/:id/join')
  @Roles(UserRole.STUDENT)
  leave(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.connect.leave(id, user);
  }

  @Post('groups/:id/posts')
  @Roles(UserRole.STUDENT, UserRole.TEACHER)
  createPost(
    @Param('id') id: string,
    @Body() dto: ConnectPostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.connect.createPost(id, dto, user);
  }

  @Get('pending-posts')
  @Roles(UserRole.TEACHER)
  pendingPosts() {
    return this.connect.pendingPosts();
  }

  @Patch('posts/:id/approve')
  @Roles(UserRole.TEACHER)
  approvePost(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.connect.approvePost(id, user);
  }

  @Patch('posts/:id')
  @Roles(UserRole.TEACHER)
  updatePost(
    @Param('id') id: string,
    @Body() dto: UpdateConnectPostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.connect.updatePost(id, dto, user);
  }

  @Delete('posts/:id')
  @Roles(UserRole.TEACHER)
  deletePost(@Param('id') id: string) {
    return this.connect.deletePost(id);
  }

  @Post('posts/:id/comments')
  @Roles(UserRole.STUDENT, UserRole.TEACHER)
  comment(
    @Param('id') id: string,
    @Body() dto: ConnectCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.connect.comment(id, dto, user);
  }

  @Delete('comments/:id')
  @Roles(UserRole.TEACHER)
  deleteComment(@Param('id') id: string) {
    return this.connect.deleteComment(id);
  }

  @Post('posts/:id/reaction')
  @Roles(UserRole.STUDENT)
  toggleReaction(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.connect.toggleReaction(id, user);
  }
}
