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
import { AuthenticatedUser } from '../auth/auth.types';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Controller('articles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get('manage')
  @Roles(UserRole.TEACHER)
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.articles.listMine(user.id);
  }

  @Post('manage')
  @Roles(UserRole.TEACHER)
  create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.create(dto, user.id);
  }

  @Patch('manage/:id')
  @Roles(UserRole.TEACHER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.update(id, dto, user.id);
  }

  @Delete('manage/:id')
  @Roles(UserRole.TEACHER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.remove(id, user.id);
  }

  @Post('manage/:id/publish')
  @Roles(UserRole.TEACHER)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.setPublished(id, user.id, true);
  }

  @Post('manage/:id/unpublish')
  @Roles(UserRole.TEACHER)
  unpublish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.setPublished(id, user.id, false);
  }

  @Get()
  list() {
    return this.articles.listPublished();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.articles.getPublishedBySlug(slug);
  }
}
